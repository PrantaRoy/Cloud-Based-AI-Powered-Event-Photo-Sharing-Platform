<?php

namespace App\Models;

/**
 * Plain data object hydrated from a DynamoDB `EVENT#<id> / PHOTO#…` item.
 * Persistence lives in App\Repositories\PhotoRepository.
 */
class EventMedia
{
    public int $id;

    public int $event_id;

    public string $file_name;

    public string $original_s3_path;

    public ?string $thumbnail_s3_path = null;

    public int $uploaded_by;

    public string $processing_status = 'completed';

    public ?string $created_at = null;

    /** @var array{id: int, name: string, email: string}|null */
    public ?array $uploader = null;

    /**
     * @param  array<string, mixed>  $item
     */
    public static function fromItem(array $item): self
    {
        $media = new self;
        $media->id = (int) $item['id'];
        $media->event_id = (int) $item['event_id'];
        $media->file_name = (string) $item['file_name'];
        $media->original_s3_path = (string) $item['original_s3_path'];
        $media->thumbnail_s3_path = $item['thumbnail_s3_path'] ?? null;
        $media->uploaded_by = (int) $item['uploaded_by'];
        $media->processing_status = (string) ($item['processing_status'] ?? 'completed');
        $media->created_at = $item['created_at'] ?? null;

        return $media;
    }
}
