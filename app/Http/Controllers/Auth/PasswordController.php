<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Fortify\ResetUserPassword;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class PasswordController extends Controller
{
    public function forgotPassword(ForgotPasswordRequest $request)
    {
        try {
            $status = Password::sendResetLink($request->only('email'));

            if ($status !== Password::RESET_LINK_SENT) {
                throw ValidationException::withMessages(['email' => [trans($status)]]);
            }

            return $this->apiSuccess(trans($status));
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to send password reset link'));
        }
    }

    public function reset(ResetPasswordRequest $request, ResetUserPassword $resetUserPassword)
    {
        try {
            $status = Password::reset(
                $request->only('email', 'password', 'password_confirmation', 'token'),
                function ($user, $password) use ($request, $resetUserPassword) {
                    $resetUserPassword->reset($user, [
                        'password' => $password,
                        'password_confirmation' => $request->input('password_confirmation'),
                    ]);
                }
            );

            if ($status !== Password::PASSWORD_RESET) {
                throw ValidationException::withMessages(['email' => [trans($status)]]);
            }

            return $this->apiSuccess(trans($status));
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to reset password'));
        }
    }

    public function update(ChangePasswordRequest $request)
    {
        try {
            $request->user()->update(['password' => $request->validated('password')]);

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
