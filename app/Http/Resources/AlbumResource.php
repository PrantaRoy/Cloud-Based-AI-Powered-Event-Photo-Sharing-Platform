<?php

namespace App\Http\Resources;

use App\Models\EventMedia;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class AlbumResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $coverMedia = $this->whenLoaded('media', fn () => $this->media->first());

        return [
            'id' => $this->id,
            'name' => $this->name,
            'photo_count' => $this->whenCounted('media'),
            'cover_url' => $coverMedia instanceof EventMedia
                ? ($coverMedia->thumbnail_s3_path ? Storage::url($coverMedia->thumbnail_s3_path) : Storage::url($coverMedia->original_s3_path))
                : null,
            'media' => EventMediaResource::collection($this->whenLoaded('media')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
