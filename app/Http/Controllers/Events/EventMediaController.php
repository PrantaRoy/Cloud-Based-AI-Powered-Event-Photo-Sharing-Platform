<?php

namespace App\Http\Controllers\Events;

use App\Actions\Events\UploadEventMedia;
use App\Http\Controllers\Controller;
use App\Http\Requests\Events\StoreEventMediaRequest;
use App\Http\Resources\EventMediaResource;
use App\Models\Event;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class EventMediaController extends Controller
{
    public function store(StoreEventMediaRequest $request, Event $event, UploadEventMedia $uploadEventMedia)
    {
        try {
            Gate::authorize('uploadMedia', $event);

            $media = $uploadEventMedia->handle($event, $request->user(), $request->file('photo'));

            return $this->apiSuccess(
                'Event photo uploaded successfully',
                new EventMediaResource($media->load('uploader')),
                Response::HTTP_CREATED
            );
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage(), 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to upload event photo'));
        }
    }
}
