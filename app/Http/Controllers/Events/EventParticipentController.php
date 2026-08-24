<?php

namespace App\Http\Controllers\Events;

use App\Actions\Events\RegisterEventParticipent;
use App\Http\Controllers\Controller;
use App\Http\Requests\Events\RegisterEventParticipentRequest;
use App\Http\Requests\Events\UpdateEventParticipentStatusRequest;
use App\Http\Resources\EventParticipentResource;
use App\Models\Event;
use App\Models\EventParticipent;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class EventParticipentController extends Controller
{
    public function index(Event $event)
    {
        Gate::authorize('viewParticipants', $event);

        $participants = $event->participants()->with('user')->paginate();

        return EventParticipentResource::collection($participants);
    }

    public function store(RegisterEventParticipentRequest $request, Event $event, RegisterEventParticipent $registerEventParticipent)
    {
        Gate::authorize('register', $event);

        $participant = $registerEventParticipent->handle(
            $event,
            $request->user(),
            $request->boolean('email_notify')
        );

        return (new EventParticipentResource($participant->load('user')))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(UpdateEventParticipentStatusRequest $request, Event $event, EventParticipent $participant)
    {
        Gate::authorize('manageParticipant', $event);

        abort_if($participant->event_id !== $event->id, 404);

        $status = $request->validated('status');

        $participant->update([
            'status' => $status,
            'approved_at' => $status === 'approved' ? now() : null,
        ]);

        return new EventParticipentResource($participant->load('user'));
    }
}
