<?php

use App\Http\Controllers\AlbumController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\EmailCheckController;
use App\Http\Controllers\Auth\PasswordController;
use App\Http\Controllers\Auth\ProfileController;
use App\Http\Controllers\Events\EventController;
use App\Http\Controllers\Events\EventMediaController;
use App\Http\Controllers\Events\EventParticipentController;
use App\Http\Controllers\PhotoSearchController;
use Illuminate\Support\Facades\Route;

Route::post('register', [AuthController::class, 'register'])->name('api.register');
Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login')->name('api.login');
Route::post('forgot-password', [PasswordController::class, 'forgotPassword'])->middleware('throttle:6,1')->name('api.password.forgot');
Route::post('reset-password', [PasswordController::class, 'reset'])->middleware('throttle:6,1')->name('api.password.reset');
Route::post('check-email', [EmailCheckController::class, 'check'])->middleware('throttle:10,1')->name('api.check-email');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('logout', [AuthController::class, 'logout'])->name('api.logout');

    Route::get('profile', [ProfileController::class, 'show'])->name('api.profile.show');
    Route::patch('profile', [ProfileController::class, 'update'])->name('api.profile.update');
    Route::post('profile/photo', [ProfileController::class, 'updatePhoto'])->name('api.profile.photo');
    Route::put('password', [PasswordController::class, 'update'])->middleware('throttle:6,1')->name('api.password.update');

    Route::apiResource('events', EventController::class);
    Route::post('events/{event}/thumbnail', [EventController::class, 'updateThumbnail'])->name('events.thumbnail.update');

    Route::get('events/{event}/participants', [EventParticipentController::class, 'index'])->name('events.participants.index');
    Route::post('events/{event}/participants', [EventParticipentController::class, 'store'])->name('events.participants.store');
    Route::patch('events/{event}/participants/{participant}', [EventParticipentController::class, 'update'])->name('events.participants.update');

    Route::get('events/{event}/photos', [EventMediaController::class, 'index'])->name('events.photos.index');
    Route::post('events/{event}/photos', [EventMediaController::class, 'store'])->name('events.photos.store');
    Route::delete('events/{event}/photos/{media}', [EventMediaController::class, 'destroy'])->name('events.photos.destroy');

    Route::apiResource('albums', AlbumController::class);
    Route::post('albums/{album}/photos', [AlbumController::class, 'attachMedia'])->name('albums.photos.attach');
    Route::delete('albums/{album}/photos/{media}', [AlbumController::class, 'detachMedia'])->name('albums.photos.detach');

    Route::post('photo-search', [PhotoSearchController::class, 'search'])->name('photo-search');
});
