<?php

namespace App\Http\Controllers\Auth;

use App\Auth\AuthBroker;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class PasswordController extends Controller
{
    public function __construct(private AuthBroker $auth) {}

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        try {
            $this->auth->sendPasswordResetCode($request->validated('email'));

            // Always report success — do not leak which emails are registered.
            return $this->apiSuccess('If that email is registered, reset instructions are on their way.');
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to send password reset instructions'));
        }
    }

    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        try {
            $data = $request->validated();
            $this->auth->resetPassword($data['email'], $data['token'], $data['password']);

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
            $this->auth->changePassword(
                $request->user(),
                $request->validated('current_password'),
                $request->validated('password'),
            );

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
