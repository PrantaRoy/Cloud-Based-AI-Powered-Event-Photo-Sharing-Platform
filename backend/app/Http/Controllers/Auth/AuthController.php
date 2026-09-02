<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Auth\RegisterUser;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserProfileResource;
use App\Repositories\UserRepository;
use App\Support\Jwt\JwtManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class AuthController extends Controller
{
    public function __construct(
        private UserRepository $users,
        private JwtManager $jwt,
    ) {}

    public function register(Request $request, RegisterUser $registerUser): JsonResponse
    {
        try {
            $user = $registerUser->create($request->all());

            return $this->apiSuccess('Registration successful', [
                'user' => new UserProfileResource($user),
                'token' => $this->jwt->issue($user),
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
            $user = $this->users->findByEmail($request->validated('email'));

            if (! $user || ! Hash::check($request->validated('password'), $user->password)) {
                throw ValidationException::withMessages([
                    'email' => [trans('auth.failed')],
                ]);
            }

            return $this->apiSuccess('Login successful', [
                'user' => new UserProfileResource($user),
                'token' => $this->jwt->issue($user),
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

    public function logout(): JsonResponse
    {
        // Stateless JWT — nothing to revoke server-side. The client drops the token.
        return $this->apiSuccess('Logout successful');
    }
}
