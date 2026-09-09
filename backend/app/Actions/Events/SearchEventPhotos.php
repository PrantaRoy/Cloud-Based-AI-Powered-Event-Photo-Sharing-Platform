<?php

namespace App\Actions\Events;

use App\Models\Event;
use App\Models\EventMedia;
use App\Models\User;
use App\Repositories\FaceMatchRepository;
use App\Repositories\PhotoRepository;
use App\Services\Face\FaceSearchClient;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * One "find my photos in this event" run:
 *   1. stash the selfie in S3 under tmp/ (1-day lifecycle rule)
 *   2. invoke the search Lambda (it deletes the selfie after reading)
 *   3. persist the returned matches under USER#<id> / MATCH#<eventId>#…
 *   4. return the hydrated EventMedia for the matched photos
 *
 * The selfie is never persisted as an embedding and is removed either by
 * the Lambda or by the finally-block fallback here.
 */
class SearchEventPhotos
{
    public function __construct(
        private FaceSearchClient $search,
        private FaceMatchRepository $matches,
        private PhotoRepository $photos,
    ) {}

    /**
     * @return array{photos: list<EventMedia>, status: string}
     */
    public function handle(Event $event, User $user, UploadedFile $selfie): array
    {
        $disk = (string) config('services.face.selfie_disk');
        $prefix = trim((string) config('services.face.selfie_prefix'), '/');
        $key = "{$prefix}/{$event->id}/{$user->id}-".Str::uuid()->toString().'.jpg';

        Storage::disk($disk)->put($key, $selfie->getContent());

        try {
            $result = $this->search->search($event, $user, $key);
        } finally {
            // Belt-and-braces: the Lambda deletes it too, but never leave a
            // selfie sitting in the bucket if the invoke throws.
            try {
                Storage::disk($disk)->delete($key);
            } catch (Throwable) {
                // lifecycle rule will still expire it
            }
        }

        if ($result['status'] === 'ok') {
            $this->matches->replaceForUserEvent($user->id, $event->id, $result['matches']);
        }

        $photoIds = array_map(fn (array $m) => $m['photo_id'], $result['matches']);
        $photos = $this->photos->hydrateUploaders(
            $this->onlyForEvent($this->photos->findMany($photoIds), $event->id)
        );

        return ['photos' => $photos, 'status' => $result['status']];
    }

    /**
     * @param  list<EventMedia>  $photos
     * @return list<EventMedia>
     */
    private function onlyForEvent(array $photos, int $eventId): array
    {
        return array_values(array_filter($photos, fn (EventMedia $p) => $p->event_id === $eventId));
    }
}
