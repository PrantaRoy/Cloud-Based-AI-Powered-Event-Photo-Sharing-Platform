<?php

namespace App\Http\Controllers\Auth;

use App\Actions\Fortify\CreateNewUser;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserProfileResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class AuthController extends Controller
{
    public function register(Request $request, CreateNewUser $createNewUser)
    {
        try {
            $user = $createNewUser->create($request->all())->refresh();

            $token = $user->createToken('api')->plainTextToken;

            return $this->apiSuccess('Registration successful', [
                'user' => new UserProfileResource($user),
                'token' => $token,
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

    public function login(LoginRequest $request)
    {
        try {
            $user = User::where('email', $request->validated('email'))->first();

            if (! $user || ! Hash::check($request->validated('password'), $user->password)) {
                throw ValidationException::withMessages([
                    'email' => [trans('auth.failed')],
                ]);
            }

            $token = $user->createToken('api')->plainTextToken;

            return $this->apiSuccess('Login successful', [
                'user' => new UserProfileResource($user),
                'token' => $token,
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

    public function logout(Request $request)
    {
        try {
            $request->user()->currentAccessToken()->delete();

            return $this->apiSuccess('Logout successful');
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Logout failed'));
        }
    }
}
