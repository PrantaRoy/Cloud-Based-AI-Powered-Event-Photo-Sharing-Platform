<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdateProfilePhotoRequest;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Http\Resources\UserProfileResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        try {
            return $this->apiSuccess('Profile fetched successfully', new UserProfileResource($request->user()));
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch profile'));
        }
    }

    public function update(UpdateProfileRequest $request)
    {
        try {
            $user = $request->user();

            $user->fill($request->validated());

            if ($user->isDirty('email')) {
                $user->email_verified_at = null;
            }

            $user->save();

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

    public function updatePhoto(UpdateProfilePhotoRequest $request)
    {
        try {
            $user = $request->user();

            if ($user->profile_photo_s3) {
                Storage::delete($user->profile_photo_s3);
            }

            $path = $request->file('photo')->store("profile-photos/{$user->id}");

            $user->update(['profile_photo_s3' => $path]);

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
