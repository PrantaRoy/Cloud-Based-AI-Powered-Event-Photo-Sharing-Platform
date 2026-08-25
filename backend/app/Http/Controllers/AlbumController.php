<?php

namespace App\Http\Controllers;

use App\Http\Requests\Albums\AttachAlbumMediaRequest;
use App\Http\Requests\Albums\StoreAlbumRequest;
use App\Http\Requests\Albums\UpdateAlbumRequest;
use App\Http\Resources\AlbumResource;
use App\Models\Album;
use App\Models\EventMedia;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class AlbumController extends Controller
{
    public function index(Request $request)
    {
        try {
            $user = $request->user();

            $auto = EventMedia::query()
                ->whereHas('event', fn ($query) => $query->visibleTo($user))
                ->with('event')
                ->latest()
                ->get()
                ->groupBy('event_id')
                ->map(function ($media) {
                    $first = $media->first();

                    return [
                        'event_id' => $first->event_id,
                        'event_name' => $first->event->name,
                        'event_date' => $first->event->event_date,
                        'cover_url' => $first->thumbnail_s3_path
                            ? Storage::url($first->thumbnail_s3_path)
                            : Storage::url($first->original_s3_path),
                        'photo_count' => $media->count(),
                    ];
                })
                ->values();

            $custom = $user->albums()
                ->withCount('media')
                ->with(['media' => fn ($query) => $query->latest('event_media.created_at')->limit(1)])
                ->get();

            return $this->apiSuccess('Album List', [
                'auto' => $auto,
                'custom' => AlbumResource::collection($custom),
            ]);
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch albums'));
        }
    }

    public function show(Album $album)
    {
        try {
            Gate::authorize('view', $album);

            return $this->apiSuccess(
                'Album fetched successfully',
                new AlbumResource($album->loadCount('media')->load('media'))
            );
        } catch (AuthorizationException $e) {
            return $this->apiError($e->getMessage(), 403);
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to fetch album'));
        }
    }

    public function store(StoreAlbumRequest $request)
    {
        try {
            Gate::authorize('create', Album::class);

            $user = $request->user();
            $mediaIds = $this->visibleMediaIds($user, $request->validated('event_media_ids', []));

            $album = DB::transaction(function () use ($request, $user, $mediaIds) {
                $album = Album::create([
                    'user_id' => $user->id,
                    'name' => $request->validated('name'),
                ]);

                if (! empty($mediaIds)) {
                    $album->media()->attach(
                        collect($mediaIds)->mapWithKeys(fn ($id) => [$id => ['added_at' => now()]])->all()
                    );
                }

                return $album;
            });

            return $this->apiSuccess(
                'Album created successfully',
                new AlbumResource($album->loadCount('media')->load('media')),
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

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to create album'));
        }
    }

    public function update(UpdateAlbumRequest $request, Album $album)
    {
        try {
            Gate::authorize('update', $album);

            $album->update($request->validated());

            return $this->apiSuccess('Album updated successfully', new AlbumResource($album->loadCount('media')));
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

    public function destroy(Album $album)
    {
        try {
            Gate::authorize('delete', $album);

            $album->delete();

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

    public function attachMedia(AttachAlbumMediaRequest $request, Album $album)
    {
        try {
            Gate::authorize('update', $album);

            $mediaIds = $this->visibleMediaIds($request->user(), $request->validated('event_media_ids', []));

            $album->media()->syncWithoutDetaching(
                collect($mediaIds)->mapWithKeys(fn ($id) => [$id => ['added_at' => now()]])->all()
            );

            return $this->apiSuccess(
                'Photos added to album successfully',
                new AlbumResource($album->loadCount('media')->load('media'))
            );
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

    public function detachMedia(Album $album, EventMedia $media)
    {
        try {
            Gate::authorize('update', $album);

            $album->media()->detach($media->id);

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

    /**
     * Filter the given event media ids down to only those whose event the user may view.
     *
     * @param  array<int, int>  $mediaIds
     * @return array<int, int>
     */
    protected function visibleMediaIds(User $user, array $mediaIds): array
    {
        if (empty($mediaIds)) {
            return [];
        }

        return EventMedia::query()
            ->whereIn('id', $mediaIds)
            ->with('event')
            ->get()
            ->filter(fn (EventMedia $media) => Gate::forUser($user)->allows('view', $media->event))
            ->pluck('id')
            ->all();
    }
}
