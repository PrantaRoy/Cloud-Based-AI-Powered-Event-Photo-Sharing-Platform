<?php

namespace App\Auth;

use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Abstracts the identity provider. Two implementations, chosen at runtime by
 * App\Providers\AuthServiceProvider from whether a Cognito user pool is
 * configured:
 *
 *   - LocalAuthBroker   — passwords + HS256 JWT, all in-app (local / Docker / CI)
 *   - CognitoAuthBroker — Amazon Cognito user pool + RS256 JWT verification (AWS)
 *
 * Either way the API contract is identical: bearer token in, {user, token} out,
 * and the React SPA never knows the difference.
 */
interface AuthBroker
{
    /**
     * @param  array<string, mixed>  $input  name, email, password, password_confirmation
     * @return array{user: User, token: string}
     *
     * @throws ValidationException
     */
    public function register(array $input): array;

    /**
     * @return array{user: User, token: string}
     *
     * @throws ValidationException on bad credentials
     */
    public function login(string $email, string $password): array;

    public function logout(?User $user): void;

    /** Silent whether or not the address is known. */
    public function sendPasswordResetCode(string $email): void;

    /**
     * @throws ValidationException on a bad / expired code
     */
    public function resetPassword(string $email, string $code, string $newPassword): void;

    /**
     * @throws ValidationException when the current password is wrong
     */
    public function changePassword(User $user, string $currentPassword, string $newPassword): void;

    /** Resolve the bearer token to a user for the request guard, or null. */
    public function resolveToken(string $bearer): ?User;
}
