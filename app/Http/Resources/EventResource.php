<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

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
            'organiser' => new UserSummaryResource($this->whenLoaded('organiser')),
            'creator' => new UserSummaryResource($this->whenLoaded('creator')),
            'participants_count' => $this->whenCounted('participants'),
            'media_count' => $this->whenCounted('media'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
