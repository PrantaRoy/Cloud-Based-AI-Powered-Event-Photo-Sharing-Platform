<?php

namespace App\Http\Controllers\Events;

use App\Http\Controllers\Controller;
use App\Http\Resources\EventResource;
use App\Models\Event;
use App\Repositories\EventRepository;
use App\Repositories\MemberRepository;
use App\Repositories\PhotoRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class PublicEventController extends Controller
{
    public function __construct(
        private EventRepository $events,
        private MemberRepository $members,
        private PhotoRepository $photos,
    ) {}

    public function stats(): JsonResponse
    {
        try {
            return $this->apiSuccess('Stats fetched successfully', [
                'events' => $this->events->countPublic(),
                'participants' => $this->members->countApprovedGlobal(),
                'photos' => $this->photos->countAll(),
                'faces' => 0,
            ]);
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch stats'));
        }
    }

    public function index(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'status_group' => ['sometimes', 'string', 'in:upcoming,ongoing,archived'],
                'q' => ['sometimes', 'string', 'max:255'],
                'lat' => ['sometimes', 'numeric', 'between:-90,90'],
                'lng' => ['sometimes', 'numeric', 'between:-180,180'],
                'limit' => ['sometimes', 'integer', 'between:1,50'],
            ]);

            $limit = $validated['limit'] ?? 12;
            $events = $this->events->listPublic();

            if (isset($validated['status_group'])) {
                $allowed = Event::STATUS_GROUPS[$validated['status_group']];
                $events = array_filter($events, fn (Event $e) => in_array($e->status, $allowed, true));
            }

            if (! empty($validated['q'])) {
                $term = mb_strtolower($validated['q']);
                $events = array_filter($events, fn (Event $e) => str_contains(mb_strtolower($e->name), $term)
                    || str_contains(mb_strtolower($e->venue), $term));
            }

            $events = array_values($events);

            if (isset($validated['lat'], $validated['lng'])) {
                foreach ($events as $event) {
                    $event->distance_km = $event->latitude !== null && $event->longitude !== null
                        ? $this->haversine((float) $validated['lat'], (float) $validated['lng'], $event->latitude, $event->longitude)
                        : null;
                }
                usort($events, fn (Event $a, Event $b) => ($a->distance_km ?? INF) <=> ($b->distance_km ?? INF));
            } elseif (($validated['status_group'] ?? null) === 'archived') {
                usort($events, fn (Event $a, Event $b) => strcmp($b->event_date, $a->event_date));
            } else {
                usort($events, fn (Event $a, Event $b) => strcmp($a->event_date, $b->event_date));
            }

            $events = array_slice($events, 0, $limit);

            return $this->apiSuccess('Public events fetched successfully', EventResource::collection($this->events->hydrate($events)));
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch events'));
        }
    }

    public function show(Event $event): JsonResponse
    {
        try {
            if ($event->privacy !== 'public') {
                return $this->apiError('This event is private. Sign in to view it.', 403, [
                    'name' => $event->name,
                    'privacy' => $event->privacy,
                ]);
            }

            return $this->apiSuccess('Event fetched successfully', new EventResource($this->events->hydrate([$event])[0]));
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch event'));
        }
    }

    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $r = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $r * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
