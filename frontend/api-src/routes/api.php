<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\PhotoController;

// Public auth routes
Route::post('/auth/login',    [AuthController::class, 'login']);
Route::post('/auth/register', [AuthController::class, 'register']);

// Protected routes — require valid Cognito JWT (or local-dev token)
Route::middleware('cognito')->group(function () {
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);

    // Events
    Route::get('/events',           [EventController::class, 'index']);
    Route::post('/events',          [EventController::class, 'store']);
    Route::get('/events/{id}',      [EventController::class, 'show']);
    Route::patch('/events/{id}',    [EventController::class, 'update']);

    // Photos
    Route::post('/events/{id}/upload-url', [PhotoController::class, 'presignedUrl']);
    Route::post('/events/{id}/uploaded',   [PhotoController::class, 'uploaded']);
    Route::get('/gallery/{event_id}',      [PhotoController::class, 'gallery']);
    Route::get('/photos/mine',             [PhotoController::class, 'mine']);
    Route::post('/search/selfie',          [PhotoController::class, 'searchBySelfie']);
});
