<?php

namespace App\Http\Controllers\Events;

use App\Http\Controllers\Controller;
use App\Http\Requests\Events\StoreEventRequest;
use App\Http\Requests\Events\UpdateEventRequest;
use App\Http\Resources\EventResource;
use App\Models\Event;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class EventController extends Controller
{
    public function index(Request $request)
    {
        try {
            $user = $request->user();

            $events = Event::query()
                ->with('organiser')
                ->withCount(['participants', 'media'])
                ->when($user->role !== 'admin', function ($query) use ($user) {
                    $query->where(function ($query) use ($user) {
                        $query->where('privacy', '!=', 'private')
                            ->orWhere('organiser_id', $user->id)
                            ->orWhereHas('participants', fn ($query) => $query->where('user_id', $user->id));
                    });
                })
                ->latest('event_date')
                ->paginate();

            return $this->apiSuccess('Event List', EventResource::collection($events));
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
}
