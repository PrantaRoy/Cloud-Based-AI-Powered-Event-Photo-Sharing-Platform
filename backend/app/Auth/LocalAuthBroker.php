<?php

namespace App\Auth;

use App\Actions\Auth\RegisterUser;
use App\Models\User;
use App\Repositories\PasswordResetRepository;
use App\Repositories\UserRepository;
use App\Support\Jwt\JwtManager;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Passwords and HS256 tokens handled entirely in-app. Used when no Cognito
 * user pool is configured (local dev, Docker, CI).
 */
class LocalAuthBroker implements AuthBroker
{
    public function __construct(
        private UserRepository $users,
        private PasswordResetRepository $resets,
        private JwtManager $jwt,
        private RegisterUser $registerUser,
    ) {}

    public function register(array $input): array
    {
        $user = $this->registerUser->create($input);

        return ['user' => $user, 'token' => $this->jwt->issue($user)];
    }

    public function login(string $email, string $password): array
    {
        $user = $this->users->findByEmail($email);

        if ($user === null || ! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages(['email' => [trans('auth.failed')]]);
        }

        return ['user' => $user, 'token' => $this->jwt->issue($user)];
    }

    public function logout(?User $user): void
    {
        // Stateless — the client drops the token.
    }

    public function sendPasswordResetCode(string $email): void
    {
        $user = $this->users->findByEmail($email);
        if ($user === null) {
            return;
        }

        $token = Str::random(64);
        $this->resets->put($email, hash('sha256', $token));

        $link = rtrim((string) config('app.frontend_url'), '/')
            .'/reset-password?token='.$token.'&email='.urlencode($user->email);

        Mail::raw("Reset your EventPro password:\n\n{$link}\n\nThis link expires in 1 hour.", function ($message) use ($user) {
            $message->to($user->email)->subject('Reset your EventPro password');
        });
    }

    public function resetPassword(string $email, string $code, string $newPassword): void
    {
        $stored = $this->resets->get($email);

        if ($stored === null || ! hash_equals($stored['token_hash'], hash('sha256', $code))) {
            throw ValidationException::withMessages(['email' => [trans('passwords.token')]]);
        }

        $user = $this->users->findByEmail($email);
        if ($user === null) {
            throw ValidationException::withMessages(['email' => [trans('passwords.user')]]);
        }

        $this->users->updatePassword($user->id, Hash::make($newPassword));
        $this->resets->delete($email);
    }

    public function changePassword(User $user, string $currentPassword, string $newPassword): void
    {
        if (! Hash::check($currentPassword, $user->password)) {
            throw ValidationException::withMessages(['current_password' => [trans('auth.password')]]);
        }

        $this->users->updatePassword($user->id, Hash::make($newPassword));
    }

    public function resolveToken(string $bearer): ?User
    {
        try {
            $payload = $this->jwt->parse($bearer);
        } catch (\Throwable) {
            return null;
        }

        return $this->users->find($payload['sub']);
    }
}
