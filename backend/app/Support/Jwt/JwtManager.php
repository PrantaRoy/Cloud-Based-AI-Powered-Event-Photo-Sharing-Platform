<?php

namespace App\Support\Jwt;

use App\Models\User;
use Carbon\CarbonImmutable;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\SignatureInvalidException;
use Illuminate\Support\Str;

/**
 * Issues and verifies the stateless bearer tokens used for API auth
 * (replaces Laravel Sanctum's personal access tokens).
 */
class JwtManager
{
    private const ALGO = 'HS256';

    public function __construct(private string $secret, private int $ttlDays) {}

    public function issue(User $user): string
    {
        $now = CarbonImmutable::now();

        return JWT::encode([
            'sub' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'role' => $user->role,
            'iat' => $now->getTimestamp(),
            'exp' => $now->addDays($this->ttlDays)->getTimestamp(),
            'jti' => (string) Str::uuid(),
        ], $this->secret, self::ALGO);
    }

    /**
     * @return array{sub: int, email: string, name: string, role: string, jti: string}
     *
     * @throws ExpiredException|SignatureInvalidException|\UnexpectedValueException
     */
    public function parse(string $token): array
    {
        $payload = (array) JWT::decode($token, new Key($this->secret, self::ALGO));

        return [
            'sub' => (int) ($payload['sub'] ?? 0),
            'email' => (string) ($payload['email'] ?? ''),
            'name' => (string) ($payload['name'] ?? ''),
            'role' => (string) ($payload['role'] ?? 'visitor'),
            'jti' => (string) ($payload['jti'] ?? ''),
        ];
    }
}
