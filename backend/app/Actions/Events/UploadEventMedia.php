<?php

namespace App\Actions\Events;

use App\Models\Event;
use App\Models\EventMedia;
use App\Models\User;
use App\Repositories\PhotoRepository;
use Illuminate\Http\UploadedFile;

class UploadEventMedia
{
    public function __construct(private PhotoRepository $photos) {}

    public function handle(Event $event, User $user, UploadedFile $photo): EventMedia
    {
        $path = $photo->store("event-media/{$event->id}");

        return $this->photos->create(
            $event->id,
            $photo->getClientOriginalName(),
            (string) $path,
            $user->id,
        );
    }
}
