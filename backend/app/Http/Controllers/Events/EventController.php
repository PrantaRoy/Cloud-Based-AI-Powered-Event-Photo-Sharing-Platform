<?php

namespace App\Http\Controllers\Events;

use App\Http\Controllers\Controller;
use App\Http\Requests\Events\StoreEventRequest;
use App\Http\Requests\Events\UpdateEventRequest;
use App\Http\Requests\Events\UpdateEventThumbnailRequest;
use App\Http\Resources\EventResource;
use App\Models\Event;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class EventController extends Controller
{
    public function index(Request $request)
    {
        try {
            $user = $request->user();

            $validated = $request->validate([
                'status_group' => ['sometimes', 'string', 'in:upcoming,active,archived'],
                'scope' => ['sometimes', 'string', 'in:all,mine,organised'],
            ]);

            $scope = $validated['scope'] ?? 'all';

            $events = Event::query()
                ->with(['organiser', 'creator'])
                ->withCount(['participants', 'media'])
                ->when($scope === 'all', fn ($query) => $query->visibleTo($user))
                ->when($scope === 'organised', fn ($query) => $query->where('organiser_id', $user->id))
                ->when($scope === 'mine', function ($query) use ($user) {
                    $query->whereHas('participants', fn ($query) => $query->where('user_id', $user->id)->where('status', '!=', 'rejected'))
                        ->with(['participants' => fn ($query) => $query->where('user_id', $user->id)]);
                })
                ->when(isset($validated['status_group']), fn ($query) => $query->whereIn('status', Event::STATUS_GROUPS[$validated['status_group']]))
                ->latest('event_date')
                ->paginate();

            return $this->apiSuccess('Event List', EventResource::collection($events));
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch events'));
        }
    }

    public function store(StoreEventRequest $request)
    {
        try {
            Gate::authorize('create', Event::class);

            $event = Event::create([
                ...$request->validated(),
                'organiser_id' => $request->user()->id,
                'created_by' => $request->user()->id,
            ])->refresh();

            return $this->apiSuccess(
                'Event created successfully',
                new EventResource($event->load('organiser')),
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

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to create event'));
        }
    }

    public function show(Request $request, Event $event)
    {
        try {
            Gate::authorize('view', $event);

            return $this->apiSuccess(
                'Event fetched successfully',
                new EventResource(
                    $event->load('organiser', 'creator')->loadCount(['participants', 'media'])
                )
            );
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage(), 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch event'));
        }
    }

    public function update(UpdateEventRequest $request, Event $event)
    {
        try {
            Gate::authorize('update', $event);

            $event->update($request->validated());

            return $this->apiSuccess('Event updated successfully', new EventResource($event->load('organiser')));
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage(), 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to update event'));
        }
    }

    public function destroy(Event $event)
    {
        try {
            Gate::authorize('delete', $event);

            $event->delete();

            return $this->apiSuccess('Event deleted successfully');
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage(), 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to delete event'));
        }
    }

    public function updateThumbnail(UpdateEventThumbnailRequest $request, Event $event)
    {
        try {
            Gate::authorize('update', $event);

            if ($event->thumbnail_s3_path) {
                Storage::delete($event->thumbnail_s3_path);
            }

            $path = $request->file('thumbnail')->store("event-thumbnails/{$event->id}");

            $event->update(['thumbnail_s3_path' => $path]);

            return $this->apiSuccess('Event thumbnail updated successfully', new EventResource($event->load('organiser')));
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage(), 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to update event thumbnail'));
        }
    }
}
