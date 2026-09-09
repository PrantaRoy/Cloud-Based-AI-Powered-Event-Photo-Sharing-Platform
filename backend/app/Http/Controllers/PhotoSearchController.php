<?php

namespace App\Http\Controllers;

use App\Actions\Events\SearchEventPhotos;
use App\Http\Requests\PhotoSearchRequest;
use App\Http\Resources\EventMediaResource;
use App\Models\Event;
use App\Repositories\FaceMatchRepository;
use App\Repositories\MemberRepository;
use App\Repositories\PhotoRepository;
use App\Services\Face\FaceSearchException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Per-event "find my photos by selfie".
 *
 * Biometric-matching consent (Privacy Act 2020) is captured here, on the
 * first search: the request must carry `consent = true`, which is then
 * stored on the caller's MEMBER# item. Without a stored consent flag and
 * without `consent = true` in the payload, the endpoint hard-blocks (403)
 * before any selfie is stored or any Lambda is invoked.
 */
class PhotoSearchController extends Controller
{
    public function __construct(
        private MemberRepository $members,
        private FaceMatchRepository $matches,
        private PhotoRepository $photos,
    ) {}

    /**
     * POST /api/events/{event}/photo-search
     */
    public function search(PhotoSearchRequest $request, Event $event): JsonResponse
    {
        try {
            Gate::authorize('searchPhotos', $event);

            $user = $request->user();

            if (! $this->members->hasFacialMatchingConsent($event->id, $user->id)) {
                if ($request->boolean('consent') !== true) {
                    return $this->apiError(
                        'Facial matching consent is required before you can search.',
                        403,
                    );
                }
                $this->members->setFacialMatchingConsent($event->id, $user->id, true);
            }

            $result = app(SearchEventPhotos::class)->handle($event, $user, $request->file('selfie'));

            return $this->apiSuccess('Photo search complete', [
                'matches' => EventMediaResource::collection($result['photos']),
                'status' => $result['status'],
            ]);
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage() ?: 'Not allowed', 403);
        } catch (FaceSearchException $e) {
            return $this->apiError($e->getMessage(), 502);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to run photo search'));
        }
    }

    /**
     * GET /api/events/{event}/photo-search/mine
     * Cheap read of previously computed matches — no re-search.
     */
    public function mine(Request $request, Event $event): JsonResponse
    {
        try {
            Gate::authorize('searchPhotos', $event);

            $user = $request->user();
            $rows = $this->matches->listForUserEvent($user->id, $event->id);
            $photoIds = array_map(fn (array $r) => (int) $r['photo_id'], $rows);

            $photos = $this->photos->hydrateUploaders(
                array_values(array_filter(
                    $this->photos->findMany($photoIds),
                    fn ($p) => $p->event_id === $event->id,
                ))
            );

            return $this->apiSuccess('Matched photos', [
                'matches' => EventMediaResource::collection($photos),
                'status' => 'ok',
            ]);
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage() ?: 'Not allowed', 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to load matched photos'));
        }
    }

    /**
     * DELETE /api/events/{event}/photo-search/consent
     * Withdraw facial-matching consent and delete stored matches.
     */
    public function withdrawConsent(Request $request, Event $event): JsonResponse
    {
        try {
            Gate::authorize('searchPhotos', $event);

            $user = $request->user();
            $this->members->setFacialMatchingConsent($event->id, $user->id, false);
            $this->matches->deleteForUserEvent($user->id, $event->id);

            return $this->apiSuccess('Facial matching turned off for this event');
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage() ?: 'Not allowed', 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to update consent'));
        }
    }
}
