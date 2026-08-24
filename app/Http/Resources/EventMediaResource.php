<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class EventMediaResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'file_name' => $this->file_name,
            'url' => Storage::url($this->original_s3_path),
            'thumbnail_url' => $this->thumbnail_s3_path ? Storage::url($this->thumbnail_s3_path) : null,
            'processing_status' => $this->processing_status,
            'uploaded_by' => new UserSummaryResource($this->whenLoaded('uploader')),
            'created_at' => $this->created_at,
        ];
    }
}
