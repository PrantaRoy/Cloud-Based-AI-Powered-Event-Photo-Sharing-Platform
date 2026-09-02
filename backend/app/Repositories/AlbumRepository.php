<?php

namespace App\Repositories;

use App\Models\Album;
use App\Models\EventMedia;

class AlbumRepository extends BaseRepository
{
    public function find(int $id): ?Album
    {
        $item = $this->dynamo->getItem($this->albumPk($id), 'META');

        return $item === null ? null : Album::fromItem($item);
    }

    /**
     * @return list<Album>
     */
    public function listForUser(int $userId): array
    {
        $items = $this->dynamo->query([
            'IndexName' => 'GSI1',
            'KeyConditionExpression' => 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
            'ExpressionAttributeValues' => [':pk' => $this->userPk($userId), ':sk' => 'ALBUM#'],
        ]);

        return array_map(fn (array $i) => Album::fromItem($i), $items);
    }

    public function create(int $userId, string $name): Album
    {
        $id = $this->nextId('album');
        $now = $this->now();

        $item = [
            'PK' => $this->albumPk($id),
            'SK' => 'META',
            'GSI1PK' => $this->userPk($userId),
            'GSI1SK' => 'ALBUM#'.str_pad((string) $id, 12, '0', STR_PAD_LEFT),
            'entity_type' => 'album',
            'id' => $id,
            'user_id' => $userId,
            'name' => $name,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $this->dynamo->putItem($item);

        return Album::fromItem($item);
    }

    public function update(int $id, string $name): Album
    {
        $item = $this->dynamo->updateItem($this->albumPk($id), 'META', [
            'name' => $name,
            'updated_at' => $this->now(),
        ]);

        return Album::fromItem($item);
    }

    public function delete(int $id): void
    {
        $items = $this->dynamo->query([
            'KeyConditionExpression' => 'PK = :pk',
            'ExpressionAttributeValues' => [':pk' => $this->albumPk($id)],
        ]);

        $keys = array_map(fn (array $i) => ['PK' => (string) $i['PK'], 'SK' => (string) $i['SK']], $items);
        $this->dynamo->batchDelete($keys);
    }

    /**
     * @return list<EventMedia>
     */
    public function listMedia(int $albumId): array
    {
        $items = $this->dynamo->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [':pk' => $this->albumPk($albumId), ':sk' => 'MEDIA#'],
        ]);

        return array_map(fn (array $i) => EventMedia::fromItem([
            'id' => $i['photo_id'],
            'event_id' => $i['event_id'],
            'file_name' => $i['file_name'],
            'original_s3_path' => $i['original_s3_path'],
            'thumbnail_s3_path' => $i['thumbnail_s3_path'] ?? null,
            'uploaded_by' => $i['uploaded_by'] ?? 0,
            'processing_status' => 'completed',
            'created_at' => $i['photo_created_at'] ?? null,
        ]), $items);
    }

    public function countMedia(int $albumId): int
    {
        return $this->dynamo->count([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [':pk' => $this->albumPk($albumId), ':sk' => 'MEDIA#'],
        ]);
    }

    public function attachMedia(int $albumId, EventMedia $media): void
    {
        $this->dynamo->putItem([
            'PK' => $this->albumPk($albumId),
            'SK' => 'MEDIA#'.$media->id,
            'entity_type' => 'album_media',
            'album_id' => $albumId,
            'photo_id' => $media->id,
            'event_id' => $media->event_id,
            'file_name' => $media->file_name,
            'original_s3_path' => $media->original_s3_path,
            'thumbnail_s3_path' => $media->thumbnail_s3_path,
            'uploaded_by' => $media->uploaded_by,
            'photo_created_at' => $media->created_at,
            'added_at' => $this->now(),
        ]);
    }

    public function detachMedia(int $albumId, int $photoId): void
    {
        $this->dynamo->deleteItem($this->albumPk($albumId), 'MEDIA#'.$photoId);
    }
}
