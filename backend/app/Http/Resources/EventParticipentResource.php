<?php

namespace App\Http\Resources;

use App\Models\EventParticipent;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin EventParticipent
 */
class EventParticipentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'registered_at' => $this->registered_at,
            'approved_at' => $this->approved_at,
            'email_notify' => $this->email_notify,
            'user' => $this->user,
        ];
    }
}
