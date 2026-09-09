<?php

namespace App\Http\Controllers\Events;

use App\Http\Controllers\Controller;
use App\Http\Requests\Events\StoreEventRequest;
use App\Http\Requests\Events\UpdateEventRequest;
use App\Http\Requests\Events\UpdateEventThumbnailRequest;
use App\Http\Resources\EventResource;
use App\Models\Event;
use App\Repositories\EventRepository;
use App\Repositories\MemberRepository;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class EventController extends Controller
{
    public function __construct(
        private EventRepository $events,
        private MemberRepository $members,
    ) {}

    public function index(Request $request): JsonResponse
    {
        try {
            $user = $request->user();

            $validated = $request->validate([
                'status_group' => ['sometimes', 'string', 'in:upcoming,ongoing,archived'],
                'scope' => ['sometimes', 'string', 'in:all,mine,organised'],
            ]);

            $scope = $validated['scope'] ?? 'all';
            $memberships = collect($this->members->listForUser($user->id))
                ->keyBy(fn (array $m) => (int) $m['event_id']);

            if ($scope === 'organised') {
                $ids = $memberships->filter(fn ($m) => ($m['is_organiser'] ?? false) === true)->keys()->all();
                $events = $this->events->findMany($ids);
            } elseif ($scope === 'mine') {
                $ids = $memberships->filter(fn ($m) => ($m['status'] ?? null) !== 'rejected')->keys()->all();
                $events = $this->events->findMany($ids);
            } elseif ($user->role === 'admin') {
                $events = $this->events->listAllForAdmin();
            } else {
                $events = $this->events->listPublic();
                $mineIds = $memberships->filter(fn ($m) => ($m['status'] ?? null) !== 'rejected')->keys()->all();
                $seen = array_map(fn (Event $e) => $e->id, $events);
                foreach ($this->events->findMany(array_diff($mineIds, $seen)) as $extra) {
                    $events[] = $extra;
                }
            }

            if (isset($validated['status_group'])) {
                $allowed = Event::STATUS_GROUPS[$validated['status_group']];
                $events = array_values(array_filter($events, fn (Event $e) => in_array($e->status, $allowed, true)));
            }

            usort($events, fn (Event $a, Event $b) => strcmp($b->event_date, $a->event_date));

            $events = $this->events->hydrate($events);
            foreach ($events as $event) {
                $membership = $memberships->get($event->id);
                $event->my_registered_at = $membership['registered_at'] ?? null;
                $event->my_status = $membership['status'] ?? null;
            }

            return $this->apiSuccess('Event List', EventResource::collection($events));
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch events'));
        }
    }

    public function store(StoreEventRequest $request): JsonResponse
    {
        try {
            Gate::authorize('create', Event::class);

            $user = $request->user();
            $event = $this->events->create($request->validated(), $user->id, $user->name, $user->email);

            return $this->apiSuccess(
                'Event created successfully',
                new EventResource($this->events->hydrate([$event])[0]),
                Response::HTTP_CREATED,
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

    public function show(Request $request, Event $event): JsonResponse
    {
        try {
            Gate::authorize('view', $event);

            $resource = $this->events->hydrate([$event])[0];

            $membership = $this->members->find($event->id, $request->user()->id);
            $resource->my_registered_at = $membership?->registered_at;
            $resource->my_status = $membership?->status;
            $resource->my_consent_facial_matching = $membership !== null && $membership->consent_facial_matching === true;

            return $this->apiSuccess(
                'Event fetched successfully',
                new EventResource($resource),
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

    public function update(UpdateEventRequest $request, Event $event): JsonResponse
    {
        try {
            Gate::authorize('update', $event);

            $updated = $this->events->update($event->id, $request->validated());

            return $this->apiSuccess('Event updated successfully', new EventResource($this->events->hydrate([$updated])[0]));
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

    public function destroy(Event $event): JsonResponse
    {
        try {
            Gate::authorize('delete', $event);

            $this->events->delete($event);

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

    public function updateThumbnail(UpdateEventThumbnailRequest $request, Event $event): JsonResponse
    {
        try {
            Gate::authorize('update', $event);

            if ($event->thumbnail_s3_path) {
                Storage::delete($event->thumbnail_s3_path);
            }

            $path = $request->file('thumbnail')->store("event-thumbnails/{$event->id}");

            $updated = $this->events->updateThumbnail($event->id, (string) $path);

            return $this->apiSuccess('Event thumbnail updated successfully', new EventResource($this->events->hydrate([$updated])[0]));
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
