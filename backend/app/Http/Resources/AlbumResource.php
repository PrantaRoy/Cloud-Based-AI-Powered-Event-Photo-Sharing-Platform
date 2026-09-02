<?php

namespace App\Http\Resources;

use App\Models\Album;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * @mixin Album
 */
class AlbumResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $cover = $this->media[0] ?? null;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'photo_count' => $this->photo_count,
            'cover_url' => $cover
                ? ($cover->thumbnail_s3_path ? Storage::url($cover->thumbnail_s3_path) : Storage::url($cover->original_s3_path))
                : null,
            'media' => EventMediaResource::collection($this->media),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
