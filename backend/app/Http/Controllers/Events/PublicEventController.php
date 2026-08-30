<?php

namespace App\Http\Controllers\Events;

use App\Http\Controllers\Controller;
use App\Http\Resources\EventResource;
use App\Models\Event;
use App\Models\EventMedia;
use App\Models\EventMediaMatchedUser;
use App\Models\EventParticipent;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class PublicEventController extends Controller
{
    /**
     * Aggregate counters for the public landing page.
     */
    public function stats()
    {
        try {
            return $this->apiSuccess('Stats fetched successfully', [
                'events' => Event::where('privacy', 'public')->count(),
                'participants' => EventParticipent::where('status', 'approved')->count(),
                'photos' => EventMedia::count(),
                'faces' => EventMediaMatchedUser::where('match_status', 'matched')->count(),
            ]);
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch stats'));
        }
    }

    /**
     * Public, unauthenticated list of `public` events. Supports a status
     * group filter (upcoming/ongoing/archived), a free-text search, and a
     * lat/lng pair that switches the ordering to nearest-first.
     */
    public function index(Request $request)
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

            $query = Event::query()
                ->with('organiser')
                ->withCount(['participants', 'media'])
                ->where('privacy', 'public');

            if (isset($validated['status_group'])) {
                $query->whereIn('status', Event::STATUS_GROUPS[$validated['status_group']]);
            }

            if (! empty($validated['q'])) {
                $term = '%'.str_replace(['%', '_'], ['\%', '\_'], $validated['q']).'%';
                $query->where(fn ($q) => $q->where('name', 'like', $term)->orWhere('venue', 'like', $term));
            }

            if (isset($validated['lat'], $validated['lng'])) {
                // Great-circle distance (km). Uses only functions common to
                // MySQL and SQLite so the demo runs on either driver.
                $haversine = '(111.045 * degrees(acos('
                    .'cos(radians(?)) * cos(radians(latitude)) * cos(radians(? - longitude)) '
                    .'+ sin(radians(?)) * sin(radians(latitude)))))';

                $query->whereNotNull('latitude')
                    ->whereNotNull('longitude')
                    ->selectRaw("events.*, {$haversine} as distance_km", [$validated['lat'], $validated['lng'], $validated['lat']])
                    ->orderBy('distance_km');
            } elseif (($validated['status_group'] ?? null) === 'archived') {
                // Past events: most recent first.
                $query->orderByDesc('event_date');
            } else {
                // Upcoming / ongoing / unfiltered: soonest first.
                $query->orderBy('event_date');
            }

            return $this->apiSuccess(
                'Public events fetched successfully',
                EventResource::collection($query->limit($limit)->get())
            );
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch events'));
        }
    }

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
