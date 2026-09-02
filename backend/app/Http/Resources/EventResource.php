<?php

namespace App\Http\Resources;

use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * @mixin Event
 */
class EventResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'public_url' => rtrim((string) config('app.frontend_url'), '/').'/e/'.$this->slug,
            'qr_code_url' => route('events.qr', $this->slug),
            'event_date' => $this->event_date,
            'venue' => $this->venue,
            'longitude' => $this->longitude,
            'latitude' => $this->latitude,
            'privacy' => $this->privacy,
            'status' => $this->status,
            'start_time' => $this->start_time,
            'end_time' => $this->end_time,
            'reg_auto_approve' => $this->reg_auto_approve,
            'thumbnail_url' => $this->thumbnail_s3_path ? Storage::url($this->thumbnail_s3_path) : null,
            'organiser' => $this->organiser,
            'creator' => $this->creator,
            'participants_count' => $this->participants_count,
            'media_count' => $this->media_count,
            'my_registered_at' => $this->my_registered_at,
            'my_status' => $this->my_status,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
