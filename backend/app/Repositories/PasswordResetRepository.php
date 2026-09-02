<?php

namespace App\Repositories;

use Carbon\CarbonImmutable;

class PasswordResetRepository extends BaseRepository
{
    private function pk(string $email): string
    {
        return 'PWRESET#'.mb_strtolower(trim($email));
    }

    public function put(string $email, string $tokenHash, int $ttlSeconds = 3600): void
    {
        $this->dynamo->putItem([
            'PK' => $this->pk($email),
            'SK' => 'LOCK',
            'entity_type' => 'password_reset',
            'email' => mb_strtolower(trim($email)),
            'token_hash' => $tokenHash,
            'ttl' => CarbonImmutable::now()->addSeconds($ttlSeconds)->getTimestamp(),
            'created_at' => $this->now(),
        ]);
    }

    /**
     * @return array{token_hash: string, ttl: int}|null
     */
    public function get(string $email): ?array
    {
        $item = $this->dynamo->getItem($this->pk($email), 'LOCK');
        if ($item === null) {
            return null;
        }

        // dynamodb-local does not enforce TTL — check it ourselves.
        if ((int) $item['ttl'] < CarbonImmutable::now()->getTimestamp()) {
            $this->delete($email);

            return null;
        }

        return ['token_hash' => (string) $item['token_hash'], 'ttl' => (int) $item['ttl']];
    }

    public function delete(string $email): void
    {
        $this->dynamo->deleteItem($this->pk($email), 'LOCK');
    }
}
