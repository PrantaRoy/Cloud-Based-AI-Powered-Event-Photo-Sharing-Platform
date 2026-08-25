<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

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
            'organiser' => new UserSummaryResource($this->whenLoaded('organiser')),
            'creator' => new UserSummaryResource($this->whenLoaded('creator')),
            'participants_count' => $this->whenCounted('participants'),
            'media_count' => $this->whenCounted('media'),
            'my_registered_at' => $this->whenLoaded('participants', fn () => optional($this->participants->first())->registered_at),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
