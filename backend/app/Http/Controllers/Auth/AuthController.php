<?php

namespace App\Http\Controllers\Auth;

use App\Auth\AuthBroker;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserProfileResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class AuthController extends Controller
{
    public function __construct(private AuthBroker $auth) {}

    public function register(Request $request): JsonResponse
    {
        try {
            $result = $this->auth->register($request->all());

            return $this->apiSuccess('Registration successful', [
                'user' => new UserProfileResource($result['user']),
                'token' => $result['token'],
            ], Response::HTTP_CREATED);
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Registration failed'));
        }
    }

    public function login(LoginRequest $request): JsonResponse
    {
        try {
            $result = $this->auth->login($request->validated('email'), $request->validated('password'));

            return $this->apiSuccess('Login successful', [
                'user' => new UserProfileResource($result['user']),
                'token' => $result['token'],
            ]);
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Login failed'));
        }
    }

    public function logout(Request $request): JsonResponse
    {
        $this->auth->logout($request->user());

        return $this->apiSuccess('Logout successful');
    }
}
