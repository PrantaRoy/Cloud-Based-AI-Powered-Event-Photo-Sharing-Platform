<?php

namespace App\Actions\Events;

use App\Models\Event;
use App\Models\EventMedia;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class UploadEventMedia
{
    public function handle(Event $event, User $user, UploadedFile $photo): EventMedia
    {
        $path = $photo->store("event-media/{$event->id}");

        return DB::transaction(fn () => $event->media()->create([
            'file_name' => $photo->getClientOriginalName(),
            'original_s3_path' => $path,
            'uploaded_by' => $user->id,
            'processing_status' => 'completed',
        ]));
    }
}
