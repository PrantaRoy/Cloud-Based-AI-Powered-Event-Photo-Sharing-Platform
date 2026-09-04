<?php

namespace App\Repositories;

use App\Models\User;
use App\Support\Dynamo\DynamoConflictException;

class UserRepository extends BaseRepository
{
    public function find(int $id): ?User
    {
        $item = $this->dynamo->getItem($this->userPk($id), 'PROFILE');

        return $item === null ? null : User::fromItem($item);
    }

    /**
     * @param  list<int>  $ids
     * @return array<int, User> keyed by user id
     */
    public function findMany(array $ids): array
    {
        $ids = array_values(array_unique($ids));
        if ($ids === []) {
            return [];
        }

        $keys = array_map(fn (int $id) => ['PK' => $this->userPk($id), 'SK' => 'PROFILE'], $ids);

        $users = [];
        foreach ($this->dynamo->batchGet($keys) as $item) {
            $user = User::fromItem($item);
            $users[$user->id] = $user;
        }

        return $users;
    }

    public function findByEmail(string $email): ?User
    {
        $item = $this->dynamo->queryFirst([
            'IndexName' => 'GSI1',
            'KeyConditionExpression' => 'GSI1PK = :pk',
            'ExpressionAttributeValues' => [':pk' => $this->emailKey($email)],
        ]);

        return $item === null ? null : User::fromItem($item);
    }

    public function emailExists(string $email, ?int $exceptId = null): bool
    {
        $user = $this->findByEmail($email);

        return $user !== null && $user->id !== $exceptId;
    }

    public function findByCognitoSub(string $sub): ?User
    {
        $pointer = $this->dynamo->getItem('COGNITO#'.$sub, 'LOCK');
        if ($pointer === null || ! isset($pointer['user_id'])) {
            return null;
        }

        return $this->find((int) $pointer['user_id']);
    }

    /**
     * Mirror a Cognito identity into a local `USER#<int>` profile the first
     * time we see it, keyed to the Cognito `sub` via a `COGNITO#<sub>` pointer.
     */
    public function createFromCognito(string $sub, string $email, string $name): User
    {
        $id = $this->nextId('user');
        $now = $this->now();
        $email = mb_strtolower(trim($email));

        $profile = [
            'PK' => $this->userPk($id),
            'SK' => 'PROFILE',
            'GSI1PK' => $this->emailKey($email),
            'GSI1SK' => $this->userPk($id),
            'entity_type' => 'user',
            'id' => $id,
            'name' => $name !== '' ? $name : $email,
            'email' => $email,
            'password' => '',
            'role' => 'visitor',
            'email_verified_at' => $now,
            'profile_photo_s3' => null,
            'cognito_sub' => $sub,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        try {
            $this->dynamo->transactWrite([
                ['Put' => [
                    'Item' => ['PK' => 'COGNITO#'.$sub, 'SK' => 'LOCK', 'entity_type' => 'cognito_lock', 'user_id' => $id],
                    'ConditionExpression' => 'attribute_not_exists(PK)',
                ]],
                ['Put' => ['Item' => ['PK' => $this->emailKey($email), 'SK' => 'LOCK', 'entity_type' => 'email_lock', 'user_id' => $id]]],
                ['Put' => ['Item' => $profile]],
            ]);
        } catch (DynamoConflictException) {
            // Concurrent first login — the other request won the pointer.
            $existing = $this->findByCognitoSub($sub);
            if ($existing !== null) {
                return $existing;
            }
            throw new \RuntimeException('Failed to provision Cognito user.');
        }

        return User::fromItem($profile);
    }

    /**
     * @param  array{name: string, email: string, password: string, role?: string}  $data
     *
     * @throws DynamoConflictException when the email is already taken
     */
    public function create(array $data): User
    {
        $id = $this->nextId('user');
        $now = $this->now();
        $email = mb_strtolower(trim($data['email']));

        $profile = [
            'PK' => $this->userPk($id),
            'SK' => 'PROFILE',
            'GSI1PK' => $this->emailKey($email),
            'GSI1SK' => $this->userPk($id),
            'entity_type' => 'user',
            'id' => $id,
            'name' => $data['name'],
            'email' => $email,
            'password' => $data['password'],
            'role' => $data['role'] ?? 'visitor',
            'email_verified_at' => $now,
            'profile_photo_s3' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $this->dynamo->transactWrite([
            ['Put' => [
                'Item' => [
                    'PK' => $this->emailKey($email),
                    'SK' => 'LOCK',
                    'entity_type' => 'email_lock',
                    'user_id' => $id,
                ],
                'ConditionExpression' => 'attribute_not_exists(PK)',
            ]],
            ['Put' => ['Item' => $profile]],
        ]);

        return User::fromItem($profile);
    }

    /**
     * @param  array{name?: string, email?: string}  $data
     *
     * @throws DynamoConflictException when the new email is already taken
     */
    public function update(int $id, array $data): User
    {
        $current = $this->find($id);
        if ($current === null) {
            throw new \RuntimeException("User {$id} not found");
        }

        $set = ['updated_at' => $this->now()];

        if (isset($data['name'])) {
            $set['name'] = $data['name'];
        }

        $newEmail = isset($data['email']) ? mb_strtolower(trim($data['email'])) : null;
        if ($newEmail !== null && $newEmail !== $current->email) {
            // Claim the new lock, release the old one, then repoint GSI1.
            $this->dynamo->transactWrite([
                ['Put' => [
                    'Item' => [
                        'PK' => $this->emailKey($newEmail),
                        'SK' => 'LOCK',
                        'entity_type' => 'email_lock',
                        'user_id' => $id,
                    ],
                    'ConditionExpression' => 'attribute_not_exists(PK)',
                ]],
                ['Delete' => ['Key' => ['PK' => $this->emailKey($current->email), 'SK' => 'LOCK']]],
            ]);

            $set['email'] = $newEmail;
            $set['GSI1PK'] = $this->emailKey($newEmail);
        }

        $item = $this->dynamo->updateItem($this->userPk($id), 'PROFILE', $set);

        return User::fromItem($item);
    }

    public function updatePassword(int $id, string $hashedPassword): void
    {
        $this->dynamo->updateItem($this->userPk($id), 'PROFILE', [
            'password' => $hashedPassword,
            'updated_at' => $this->now(),
        ]);
    }

    public function updateProfilePhoto(int $id, ?string $path): User
    {
        $item = $this->dynamo->updateItem($this->userPk($id), 'PROFILE', [
            'profile_photo_s3' => $path,
            'updated_at' => $this->now(),
        ]);

        return User::fromItem($item);
    }
}
