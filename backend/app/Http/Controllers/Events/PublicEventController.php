<?php

namespace App\Http\Controllers\Events;

use App\Http\Controllers\Controller;
use App\Http\Resources\EventResource;
use App\Models\Event;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class PublicEventController extends Controller
{
    /**
     * Public, unauthenticated view of an event resolved by its slug.
     *
     * Only `public` events are exposed in full. For anything else we still
     * return the name so the landing page can prompt the visitor to sign in.
     */
    public function show(Event $event)
    {
        try {
            if ($event->privacy !== 'public') {
                return $this->apiError('This event is private. Sign in to view it.', 403, [
                    'name' => $event->name,
                    'privacy' => $event->privacy,
                ]);
            }

            return $this->apiSuccess(
                'Event fetched successfully',
                new EventResource(
                    $event->load('organiser')->loadCount(['participants', 'media'])
                )
            );
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch event'));
        }
    }
}
