<?php

namespace App\Models;

/**
 * Plain data object hydrated from a DynamoDB `ALBUM#<id> / META` item.
 * Persistence lives in App\Repositories\AlbumRepository.
 */
class Album
{
    public int $id;

    public int $user_id;

    public string $name;

    public ?string $created_at = null;

    public ?string $updated_at = null;

    public int $photo_count = 0;

    /** @var list<EventMedia> */
    public array $media = [];

    /**
     * @param  array<string, mixed>  $item
     */
    public static function fromItem(array $item): self
    {
        $album = new self;
        $album->id = (int) $item['id'];
        $album->user_id = (int) $item['user_id'];
        $album->name = (string) $item['name'];
        $album->created_at = $item['created_at'] ?? null;
        $album->updated_at = $item['updated_at'] ?? null;

        return $album;
    }
}
