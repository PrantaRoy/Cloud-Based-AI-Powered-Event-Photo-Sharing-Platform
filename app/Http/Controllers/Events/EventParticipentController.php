<?php

namespace App\Http\Controllers\Events;

use App\Actions\Events\RegisterEventParticipent;
use App\Http\Controllers\Controller;
use App\Http\Requests\Events\RegisterEventParticipentRequest;
use App\Http\Requests\Events\UpdateEventParticipentStatusRequest;
use App\Http\Resources\EventParticipentResource;
use App\Models\Event;
use App\Models\EventParticipent;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class EventParticipentController extends Controller
{
    public function index(Event $event)
    {
        try {
            Gate::authorize('viewParticipants', $event);

            $participants = $event->participants()->with('user')->paginate();

            return $this->apiSuccess('Participant List', EventParticipentResource::collection($participants));
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage(), 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch participants'));
        }
    }

    public function store(RegisterEventParticipentRequest $request, Event $event, RegisterEventParticipent $registerEventParticipent)
    {
        try {
            Gate::authorize('register', $event);

            $participant = $registerEventParticipent->handle(
                $event,
                $request->user(),
                $request->boolean('email_notify')
            );

            return $this->apiSuccess(
                'Participant registered successfully',
                new EventParticipentResource($participant->load('user')),
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

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to register participant'));
        }
    }

    public function update(UpdateEventParticipentStatusRequest $request, Event $event, EventParticipent $participant)
    {
        try {
            Gate::authorize('manageParticipant', $event);

            abort_if($participant->event_id !== $event->id, 404);

            $status = $request->validated('status');

            $participant->update([
                'status' => $status,
                'approved_at' => $status === 'approved' ? now() : null,
            ]);

            return $this->apiSuccess(
                'Participant status updated successfully',
                new EventParticipentResource($participant->load('user'))
            );
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage(), 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to update participant status'));
        }
    }
}
