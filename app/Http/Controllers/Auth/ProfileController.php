<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdateProfilePhotoRequest;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Http\Resources\UserProfileResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        return new UserProfileResource($request->user());
    }

    public function update(UpdateProfileRequest $request)
    {
        $user = $request->user();

        $user->fill($request->validated());

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        return new UserProfileResource($user);
    }

    public function updatePhoto(UpdateProfilePhotoRequest $request)
    {
        $user = $request->user();

        if ($user->profile_photo_s3) {
            Storage::delete($user->profile_photo_s3);
        }

        $path = $request->file('photo')->store("profile-photos/{$user->id}");

        $user->update(['profile_photo_s3' => $path]);

        return new UserProfileResource($user);
    }
}
