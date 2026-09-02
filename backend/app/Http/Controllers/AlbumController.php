<?php

namespace App\Http\Controllers;

use App\Http\Requests\Albums\AttachAlbumMediaRequest;
use App\Http\Requests\Albums\StoreAlbumRequest;
use App\Http\Requests\Albums\UpdateAlbumRequest;
use App\Http\Resources\AlbumResource;
use App\Models\Album;
use App\Models\EventMedia;
use App\Models\User;
use App\Repositories\AlbumRepository;
use App\Repositories\EventRepository;
use App\Repositories\MemberRepository;
use App\Repositories\PhotoRepository;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class AlbumController extends Controller
{
    public function __construct(
        private AlbumRepository $albums,
        private PhotoRepository $photos,
        private MemberRepository $members,
        private EventRepository $events,
    ) {}

    public function index(Request $request): JsonResponse
    {
        try {
            $user = $request->user();

            $eventIds = collect($this->members->listForUser($user->id))
                ->filter(fn (array $m) => in_array($m['status'] ?? null, ['approved'], true) || ($m['is_organiser'] ?? false))
                ->map(fn (array $m) => (int) $m['event_id'])
                ->all();

            $auto = collect($this->events->findMany($eventIds))
                ->map(function ($event) {
                    $media = $this->photos->listForEvent($event->id);
                    if ($media === []) {
                        return null;
                    }
                    $first = $media[0];

                    return [
                        'event_id' => $event->id,
                        'event_name' => $event->name,
                        'event_date' => $event->event_date,
                        'cover_url' => $first->thumbnail_s3_path
                            ? Storage::url($first->thumbnail_s3_path)
                            : Storage::url($first->original_s3_path),
                        'photo_count' => count($media),
                    ];
                })
                ->filter()
                ->values();

            $custom = array_map(fn (Album $album) => $this->hydrate($album, withMedia: false), $this->albums->listForUser($user->id));

            return $this->apiSuccess('Album List', [
                'auto' => $auto,
                'custom' => AlbumResource::collection($custom),
            ]);
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch albums'));
        }
    }

    public function show(Album $album): JsonResponse
    {
        try {
            Gate::authorize('view', $album);

            return $this->apiSuccess('Album fetched successfully', new AlbumResource($this->hydrate($album)));
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage(), 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch album'));
        }
    }

    public function store(StoreAlbumRequest $request): JsonResponse
    {
        try {
            Gate::authorize('create', Album::class);

            $user = $request->user();
            $media = $this->visibleMedia($user, $request->validated('event_media_ids', []));

            $album = $this->albums->create($user->id, $request->validated('name'));
            foreach ($media as $item) {
                $this->albums->attachMedia($album->id, $item);
            }

            return $this->apiSuccess(
                'Album created successfully',
                new AlbumResource($this->hydrate($album)),
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

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to create album'));
        }
    }

    public function update(UpdateAlbumRequest $request, Album $album): JsonResponse
    {
        try {
            Gate::authorize('update', $album);

            $updated = $this->albums->update($album->id, $request->validated('name'));

            return $this->apiSuccess('Album updated successfully', new AlbumResource($this->hydrate($updated, withMedia: false)));
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage(), 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to update album'));
        }
    }

    public function destroy(Album $album): JsonResponse
    {
        try {
            Gate::authorize('delete', $album);

            $this->albums->delete($album->id);

            return $this->apiSuccess('Album deleted successfully');
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage(), 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to delete album'));
        }
    }

    public function attachMedia(AttachAlbumMediaRequest $request, Album $album): JsonResponse
    {
        try {
            Gate::authorize('update', $album);

            foreach ($this->visibleMedia($request->user(), $request->validated('event_media_ids', [])) as $item) {
                $this->albums->attachMedia($album->id, $item);
            }

            return $this->apiSuccess('Photos added to album successfully', new AlbumResource($this->hydrate($album)));
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage(), 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to add photos to album'));
        }
    }

    public function detachMedia(Album $album, EventMedia $media): JsonResponse
    {
        try {
            Gate::authorize('update', $album);

            $this->albums->detachMedia($album->id, $media->id);

            return $this->apiSuccess('Photo removed from album successfully');
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage(), 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to remove photo from album'));
        }
    }

    private function hydrate(Album $album, bool $withMedia = true): Album
    {
        $media = $this->photos->hydrateUploaders($this->albums->listMedia($album->id));
        $album->photo_count = count($media);
        $album->media = $withMedia ? $media : array_slice($media, 0, 1);

        return $album;
    }

    /**
     * Filter media ids down to those whose event the user may view.
     *
     * @param  array<int, int|string>  $mediaIds
     * @return list<EventMedia>
     */
    private function visibleMedia(User $user, array $mediaIds): array
    {
        $out = [];
        foreach ($this->photos->findMany($mediaIds) as $media) {
            $event = $this->events->find($media->event_id);
            if ($event !== null && Gate::forUser($user)->allows('view', $event)) {
                $out[] = $media;
            }
        }

        return $out;
    }
}
