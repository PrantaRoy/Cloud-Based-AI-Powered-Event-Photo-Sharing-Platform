<?php

namespace App\Actions\Events;

use App\Models\Event;
use App\Models\EventMedia;
use App\Models\User;
use App\Repositories\PhotoRepository;
use App\Services\Face\FaceIndexDispatcher;
use Illuminate\Http\UploadedFile;

class UploadEventMedia
{
    public function __construct(
        private PhotoRepository $photos,
        private FaceIndexDispatcher $faceIndex,
    ) {}

    public function handle(Event $event, User $user, UploadedFile $photo): EventMedia
    {
        $path = $photo->store("event-media/{$event->id}");

        // When the face pipeline is wired up, the photo starts 'queued' and
        // the index Lambda flips it to 'processed' / 'no_faces' / 'failed'.
        // Otherwise it's immediately 'completed' as before.
        $status = $this->faceIndex->enabled() ? 'queued' : 'completed';

        $media = $this->photos->create(
            $event->id,
            $photo->getClientOriginalName(),
            (string) $path,
            $user->id,
            $status,
        );

        $this->faceIndex->enqueue($event, $media);

        return $media;
    }
}
