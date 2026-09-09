<?php

namespace App\Repositories;

use App\Models\EventMedia;

class PhotoRepository extends BaseRepository
{
    /**
     * Populate the `uploader` summary on each media item.
     *
     * @param  list<EventMedia>  $media
     * @return list<EventMedia>
     */
    public function hydrateUploaders(array $media): array
    {
        $ids = array_map(fn (EventMedia $m) => $m->uploaded_by, $media);
        $users = app(UserRepository::class)->findMany($ids);

        foreach ($media as $item) {
            $item->uploader = isset($users[$item->uploaded_by]) ? $users[$item->uploaded_by]->summary() : null;
        }

        return $media;
    }

    public function find(int $photoId): ?EventMedia
    {
        $item = $this->dynamo->queryFirst([
            'IndexName' => 'GSI1',
            'KeyConditionExpression' => 'GSI1PK = :pk',
            'ExpressionAttributeValues' => [':pk' => 'PHOTO#'.$photoId],
        ]);

        return $item === null ? null : EventMedia::fromItem($item);
    }

    /**
     * @param  array<int, int|string>  $photoIds
     * @return list<EventMedia>
     */
    public function findMany(array $photoIds): array
    {
        $out = [];
        foreach (array_unique(array_map('intval', $photoIds)) as $id) {
            $media = $this->find($id);
            if ($media !== null) {
                $out[] = $media;
            }
        }

        return $out;
    }

    /**
     * @return list<EventMedia>
     */
    public function listForEvent(int $eventId): array
    {
        $items = $this->dynamo->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [':pk' => $this->eventPk($eventId), ':sk' => 'PHOTO#'],
            'ScanIndexForward' => false,
        ]);

        return array_map(fn (array $i) => EventMedia::fromItem($i), $items);
    }

    public function create(
        int $eventId,
        string $fileName,
        string $originalPath,
        int $uploadedBy,
        string $processingStatus = 'completed',
    ): EventMedia {
        $id = $this->nextId('photo');
        $now = $this->now();

        $item = [
            'PK' => $this->eventPk($eventId),
            'SK' => 'PHOTO#'.$now.'#'.$id,
            'GSI1PK' => 'PHOTO#'.$id,
            'GSI1SK' => 'PHOTO#'.$id,
            'entity_type' => 'photo',
            'id' => $id,
            'event_id' => $eventId,
            'file_name' => $fileName,
            'original_s3_path' => $originalPath,
            'thumbnail_s3_path' => null,
            'uploaded_by' => $uploadedBy,
            'processing_status' => $processingStatus,
            'created_at' => $now,
        ];

        $this->dynamo->putItem($item);

        return EventMedia::fromItem($item);
    }

    public function delete(EventMedia $media): void
    {
        // The SK carries the creation timestamp; look the row up via GSI1 to
        // get its exact PK/SK rather than reconstructing it.
        $raw = $this->dynamo->queryFirst([
            'IndexName' => 'GSI1',
            'KeyConditionExpression' => 'GSI1PK = :pk',
            'ExpressionAttributeValues' => [':pk' => 'PHOTO#'.$media->id],
        ]);

        if ($raw !== null) {
            $this->dynamo->deleteItem((string) $raw['PK'], (string) $raw['SK']);
        }

        // Cascade: a deleted photo must not leave its face embeddings behind.
        app(FaceRepository::class)->deleteForPhoto($media->event_id, $media->id);
    }

    public function countForEvent(int $eventId): int
    {
        return $this->dynamo->count([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [':pk' => $this->eventPk($eventId), ':sk' => 'PHOTO#'],
        ]);
    }

    public function countAll(): int
    {
        return $this->dynamo->scanCount([
            'FilterExpression' => 'entity_type = :t',
            'ExpressionAttributeValues' => [':t' => 'photo'],
        ]);
    }
}
