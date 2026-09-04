<?php

namespace App\Auth;

use App\Concerns\PasswordValidationRules;
use App\Models\User;
use App\Repositories\UserRepository;
use App\Rules\UniqueEmail;
use App\Support\Cognito\CognitoTokenVerifier;
use Aws\CognitoIdentityProvider\CognitoIdentityProviderClient;
use Aws\Exception\AwsException;
use Aws\Result;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Authenticates against an Amazon Cognito user pool. Cognito owns the password,
 * the password policy, email verification and JWT issuance; a mirror profile
 * item lives in DynamoDB (`USER#<int>`) keyed to the Cognito `sub` via a
 * `COGNITO#<sub>` pointer, so the rest of the app keeps its integer user ids.
 */
class CognitoAuthBroker implements AuthBroker
{
    use PasswordValidationRules;

    public function __construct(
        private CognitoIdentityProviderClient $client,
        private CognitoTokenVerifier $verifier,
        private UserRepository $users,
        private string $userPoolId,
        private string $clientId,
        private string $clientSecret,
    ) {}

    public function register(array $input): array
    {
        $data = Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', new UniqueEmail],
            'password' => $this->passwordRules(),
        ])->validate();

        $email = mb_strtolower(trim($data['email']));

        try {
            $this->client->signUp([
                'ClientId' => $this->clientId,
                'SecretHash' => $this->secretHash($email),
                'Username' => $email,
                'Password' => $data['password'],
                'UserAttributes' => [
                    ['Name' => 'email', 'Value' => $email],
                    ['Name' => 'name', 'Value' => $data['name']],
                ],
            ]);

            // Demo simplification: confirm immediately so register → login works
            // in one step. To require the emailed code instead, drop these two
            // calls and add a /api/confirm endpoint (see DEPLOYMENT.md §2.18).
            $this->client->adminConfirmSignUp(['UserPoolId' => $this->userPoolId, 'Username' => $email]);
            $this->client->adminUpdateUserAttributes([
                'UserPoolId' => $this->userPoolId,
                'Username' => $email,
                'UserAttributes' => [['Name' => 'email_verified', 'Value' => 'true']],
            ]);
        } catch (AwsException $e) {
            throw $this->mapSignUpError($e);
        }

        return $this->issueFor($email, $data['password'], $data['name']);
    }

    public function login(string $email, string $password): array
    {
        $email = mb_strtolower(trim($email));

        try {
            return $this->issueFor($email, $password);
        } catch (AwsException) {
            throw ValidationException::withMessages(['email' => [trans('auth.failed')]]);
        }
    }

    public function logout(?User $user): void
    {
        if ($user === null) {
            return;
        }

        try {
            $this->client->adminUserGlobalSignOut(['UserPoolId' => $this->userPoolId, 'Username' => $user->email]);
        } catch (AwsException) {
            // best effort
        }
    }

    public function sendPasswordResetCode(string $email): void
    {
        try {
            $this->client->forgotPassword([
                'ClientId' => $this->clientId,
                'SecretHash' => $this->secretHash(mb_strtolower(trim($email))),
                'Username' => mb_strtolower(trim($email)),
            ]);
        } catch (AwsException) {
            // Silent — don't leak which addresses are registered.
        }
    }

    public function resetPassword(string $email, string $code, string $newPassword): void
    {
        Validator::make(['password' => $newPassword], ['password' => $this->passwordRules()])->validate();

        try {
            $this->client->confirmForgotPassword([
                'ClientId' => $this->clientId,
                'SecretHash' => $this->secretHash(mb_strtolower(trim($email))),
                'Username' => mb_strtolower(trim($email)),
                'ConfirmationCode' => $code,
                'Password' => $newPassword,
            ]);
        } catch (AwsException $e) {
            $msg = match ($e->getAwsErrorCode()) {
                'CodeMismatchException' => 'The reset code is incorrect.',
                'ExpiredCodeException' => 'The reset code has expired. Request a new one.',
                'InvalidPasswordException' => $e->getAwsErrorMessage(),
                default => trans('passwords.token'),
            };
            throw ValidationException::withMessages(['token' => [$msg]]);
        }
    }

    public function changePassword(User $user, string $currentPassword, string $newPassword): void
    {
        try {
            $this->adminAuth($user->email, $currentPassword);
        } catch (AwsException) {
            throw ValidationException::withMessages(['current_password' => [trans('auth.password')]]);
        }

        $this->client->adminSetUserPassword([
            'UserPoolId' => $this->userPoolId,
            'Username' => $user->email,
            'Password' => $newPassword,
            'Permanent' => true,
        ]);
    }

    public function resolveToken(string $bearer): ?User
    {
        try {
            $claims = $this->verifier->verify($bearer);
        } catch (\Throwable) {
            return null;
        }

        return $this->userFor($claims['sub'], $claims['email'], $claims['name']);
    }

    // --- internals ---------------------------------------------------------

    /**
     * @return array{user: User, token: string}
     */
    private function issueFor(string $email, string $password, ?string $name = null): array
    {
        $result = $this->adminAuth($email, $password);
        $idToken = (string) ($result['AuthenticationResult']['IdToken'] ?? '');
        $claims = $this->verifier->verify($idToken);

        return [
            'user' => $this->userFor($claims['sub'], $claims['email'] ?: $email, $claims['name'] ?: (string) $name),
            'token' => $idToken,
        ];
    }

    /**
     * @return Result<string, mixed>
     */
    private function adminAuth(string $email, string $password)
    {
        return $this->client->adminInitiateAuth([
            'UserPoolId' => $this->userPoolId,
            'ClientId' => $this->clientId,
            'AuthFlow' => 'ADMIN_USER_PASSWORD_AUTH',
            'AuthParameters' => [
                'USERNAME' => $email,
                'PASSWORD' => $password,
                'SECRET_HASH' => $this->secretHash($email),
            ],
        ]);
    }

    private function userFor(string $sub, string $email, string $name): User
    {
        return $this->users->findByCognitoSub($sub)
            ?? $this->users->createFromCognito($sub, $email, $name);
    }

    private function secretHash(string $username): string
    {
        return base64_encode(hash_hmac('sha256', $username.$this->clientId, $this->clientSecret, true));
    }

    private function mapSignUpError(AwsException $e): ValidationException
    {
        return match ($e->getAwsErrorCode()) {
            'UsernameExistsException' => ValidationException::withMessages(['email' => ['The email has already been taken.']]),
            'InvalidPasswordException' => ValidationException::withMessages(['password' => [$e->getAwsErrorMessage()]]),
            'InvalidParameterException' => ValidationException::withMessages(['email' => [$e->getAwsErrorMessage()]]),
            default => ValidationException::withMessages(['email' => ['Registration failed.']]),
        };
    }
}
