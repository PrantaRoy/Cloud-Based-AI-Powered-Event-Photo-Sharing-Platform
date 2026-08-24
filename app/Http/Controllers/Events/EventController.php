<?php

namespace App\Http\Controllers\Events;

use App\Http\Controllers\Controller;
use App\Http\Requests\Events\StoreEventRequest;
use App\Http\Requests\Events\UpdateEventRequest;
use App\Http\Resources\EventResource;
use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class EventController extends Controller
{
    public function index(Request $request)
    {
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

        return EventResource::collection($events);
    }

    public function store(StoreEventRequest $request)
    {
        Gate::authorize('create', Event::class);

        $event = Event::create([
            ...$request->validated(),
            'organiser_id' => $request->user()->id,
            'created_by' => $request->user()->id,
        ])->refresh();

        return (new EventResource($event->load('organiser')))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Request $request, Event $event)
    {
        Gate::authorize('view', $event);

        return new EventResource(
            $event->load('organiser', 'creator')->loadCount(['participants', 'media'])
        );
    }

    public function update(UpdateEventRequest $request, Event $event)
    {
        Gate::authorize('update', $event);

        $event->update($request->validated());

        return new EventResource($event->load('organiser'));
    }

    public function destroy(Event $event)
    {
        Gate::authorize('delete', $event);

        $event->delete();

        return response()->noContent();
    }
}
