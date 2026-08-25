<?php

namespace App\Http\Controllers\Events;

use App\Actions\Events\UploadEventMedia;
use App\Http\Controllers\Controller;
use App\Http\Requests\Events\StoreEventMediaRequest;
use App\Http\Resources\EventMediaResource;
use App\Models\Event;
use App\Models\EventMedia;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class EventMediaController extends Controller
{
    public function index(Event $event)
    {
        try {
            Gate::authorize('view', $event);

            $media = $event->media()->with('uploader')->latest()->paginate();

            return $this->apiSuccess('Event Photo List', EventMediaResource::collection($media));
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage(), 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch event photos'));
        }
    }

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

    public function destroy(Event $event, EventMedia $media)
    {
        try {
            abort_if($media->event_id !== $event->id, 404);

            Gate::authorize('deleteMedia', [$event, $media]);

            if ($media->original_s3_path) {
                Storage::delete($media->original_s3_path);
            }

            if ($media->thumbnail_s3_path) {
                Storage::delete($media->thumbnail_s3_path);
            }

            $media->delete();

            return $this->apiSuccess('Event photo deleted successfully');
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage(), 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to delete event photo'));
        }
    }
}
