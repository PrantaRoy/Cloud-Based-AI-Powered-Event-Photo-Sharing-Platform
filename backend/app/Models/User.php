<?php

namespace App\Models;

use Illuminate\Contracts\Auth\Authenticatable;

/**
 * Plain data object hydrated from a DynamoDB `USER#<id> / PROFILE` item.
 *
 * Not an Eloquent model — there is no relational database. Persistence lives
 * in App\Repositories\UserRepository.
 */
class User implements Authenticatable
{
    public int $id;

    public string $name;

    public string $email;

    public ?string $email_verified_at = null;

    public string $password = '';

    public string $role = 'visitor';

    public ?string $profile_photo_s3 = null;

    public ?string $created_at = null;

    public ?string $updated_at = null;

    /**
     * @param  array<string, mixed>  $item
     */
    public static function fromItem(array $item): self
    {
        $user = new self;
        $user->id = (int) $item['id'];
        $user->name = (string) $item['name'];
        $user->email = (string) $item['email'];
        $user->email_verified_at = $item['email_verified_at'] ?? null;
        $user->password = (string) ($item['password'] ?? '');
        $user->role = (string) ($item['role'] ?? 'visitor');
        $user->profile_photo_s3 = $item['profile_photo_s3'] ?? null;
        $user->created_at = $item['created_at'] ?? null;
        $user->updated_at = $item['updated_at'] ?? null;

        return $user;
    }

    /**
     * Compact form embedded in other resources (organiser, uploader, …).
     *
     * @return array{id: int, name: string, email: string}
     */
    public function summary(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'email' => $this->email];
    }

    // --- Authenticatable -------------------------------------------------

    public function getAuthIdentifierName(): string
    {
        return 'id';
    }

    public function getAuthIdentifier(): int
    {
        return $this->id;
    }

    public function getAuthPasswordName(): string
    {
        return 'password';
    }

    public function getAuthPassword(): string
    {
        return $this->password;
    }

    public function getRememberToken(): string
    {
        return '';
    }

    public function setRememberToken($value): void
    {
        // Stateless JWT auth — no remember token.
    }

    public function getRememberTokenName(): ?string
    {
        return null;
    }
}
