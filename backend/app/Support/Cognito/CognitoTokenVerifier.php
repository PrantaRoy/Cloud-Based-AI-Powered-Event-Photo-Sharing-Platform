<?php

namespace App\Support\Cognito;

use Firebase\JWT\ExpiredException;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\SignatureInvalidException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use UnexpectedValueException;

/**
 * Verifies a Cognito-issued JWT (ID or access token) against the user pool's
 * public JWKS: RS256 signature, issuer, audience/client_id, token_use, expiry.
 */
class CognitoTokenVerifier
{
    public function __construct(
        private string $region,
        private string $userPoolId,
        private string $clientId,
    ) {}

    public function issuer(): string
    {
        return "https://cognito-idp.{$this->region}.amazonaws.com/{$this->userPoolId}";
    }

    /**
     * @return array{sub: string, email: string, name: string}
     *
     * @throws UnexpectedValueException|ExpiredException|SignatureInvalidException
     */
    public function verify(string $jwt): array
    {
        $claims = $this->decode($jwt);

        if (($claims['iss'] ?? null) !== $this->issuer()) {
            throw new UnexpectedValueException('Token issuer mismatch.');
        }

        $tokenUse = $claims['token_use'] ?? null;
        if ($tokenUse === 'id' && ($claims['aud'] ?? null) !== $this->clientId) {
            throw new UnexpectedValueException('Token audience mismatch.');
        }
        if ($tokenUse === 'access' && ($claims['client_id'] ?? null) !== $this->clientId) {
            throw new UnexpectedValueException('Token client_id mismatch.');
        }
        if (! in_array($tokenUse, ['id', 'access'], true)) {
            throw new UnexpectedValueException('Unexpected token_use.');
        }

        return [
            'sub' => (string) ($claims['sub'] ?? ''),
            'email' => (string) ($claims['email'] ?? ''),
            'name' => (string) ($claims['name'] ?? $claims['cognito:username'] ?? ''),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function decode(string $jwt): array
    {
        try {
            return (array) JWT::decode($jwt, $this->keySet());
        } catch (UnexpectedValueException $e) {
            // A rotated signing key won't be in the cached set — refresh once.
            if (str_contains($e->getMessage(), '"kid"')) {
                Cache::forget($this->cacheKey());

                return (array) JWT::decode($jwt, $this->keySet());
            }
            throw $e;
        }
    }

    /**
     * @return array<string, Key>
     */
    private function keySet(): array
    {
        $jwks = Cache::remember($this->cacheKey(), now()->addHours(6), fn () => Http::get($this->issuer().'/.well-known/jwks.json')->throw()->json());

        return JWK::parseKeySet($jwks);
    }

    private function cacheKey(): string
    {
        return 'cognito.jwks.'.$this->userPoolId;
    }
}
