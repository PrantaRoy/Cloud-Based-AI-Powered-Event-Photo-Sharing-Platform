<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdateProfilePhotoRequest;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Http\Resources\UserProfileResource;
use App\Repositories\UserRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class ProfileController extends Controller
{
    public function __construct(private UserRepository $users) {}

    public function show(Request $request): JsonResponse
    {
        try {
            return $this->apiSuccess('Profile fetched successfully', new UserProfileResource($request->user()));
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch profile'));
        }
    }

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        try {
            $user = $this->users->update($request->user()->id, $request->validated());

            return $this->apiSuccess('Profile updated successfully', new UserProfileResource($user));
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to update profile'));
        }
    }

    public function updatePhoto(UpdateProfilePhotoRequest $request): JsonResponse
    {
        try {
            $user = $request->user();

            if ($user->profile_photo_s3) {
                Storage::delete($user->profile_photo_s3);
            }

            $path = $request->file('photo')->store("profile-photos/{$user->id}");

            $user = $this->users->updateProfilePhoto($user->id, (string) $path);

            return $this->apiSuccess('Profile photo updated successfully', new UserProfileResource($user));
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to update profile photo'));
        }
    }
}
