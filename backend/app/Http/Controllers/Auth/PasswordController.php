<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Repositories\PasswordResetRepository;
use App\Repositories\UserRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class PasswordController extends Controller
{
    public function __construct(
        private UserRepository $users,
        private PasswordResetRepository $resets,
    ) {}

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        try {
            $email = $request->validated('email');
            $user = $this->users->findByEmail($email);

            if ($user !== null) {
                $token = Str::random(64);
                $this->resets->put($email, hash('sha256', $token));

                $link = rtrim((string) config('app.frontend_url'), '/')
                    .'/reset-password?token='.$token.'&email='.urlencode($user->email);

                Mail::raw("Reset your EventPro password:\n\n{$link}\n\nThis link expires in 1 hour.", function ($message) use ($user) {
                    $message->to($user->email)->subject('Reset your EventPro password');
                });
            }

            // Always report success — do not leak which emails are registered.
            return $this->apiSuccess('If that email is registered, a reset link is on its way.');
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to send password reset link'));
        }
    }

    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        try {
            $data = $request->validated();
            $stored = $this->resets->get($data['email']);

            if ($stored === null || ! hash_equals($stored['token_hash'], hash('sha256', $data['token']))) {
                throw ValidationException::withMessages(['email' => [trans('passwords.token')]]);
            }

            $user = $this->users->findByEmail($data['email']);
            if ($user === null) {
                throw ValidationException::withMessages(['email' => [trans('passwords.user')]]);
            }

            $this->users->updatePassword($user->id, Hash::make($data['password']));
            $this->resets->delete($data['email']);

            return $this->apiSuccess('Your password has been reset.');
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to reset password'));
        }
    }

    public function update(ChangePasswordRequest $request): JsonResponse
    {
        try {
            $user = $request->user();

            if (! Hash::check($request->validated('current_password'), $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => [trans('auth.password')],
                ]);
            }

            $this->users->updatePassword($user->id, Hash::make($request->validated('password')));

            return $this->apiSuccess('Password updated successfully');
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to update password'));
        }
    }
}
