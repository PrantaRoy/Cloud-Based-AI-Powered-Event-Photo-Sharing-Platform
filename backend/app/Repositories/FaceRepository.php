<?php

namespace App\Repositories;

/**
 * Face embeddings detected in event photos.
 *
 * Items live in the event partition so matching is a single Query:
 *   PK = EVENT#<eventId>, SK begins_with "FACE#"
 *
 * The rows themselves are written by the index Lambda (Python); PHP only
 * needs to count them and cascade-delete them when a photo is removed.
 *
 *   PK          = EVENT#<eventId>
 *   SK          = FACE#<photoId>#<index>
 *   entity_type = face
 *   embedding   = <Binary>  (128 x float32)
 */
class FaceRepository extends BaseRepository
{
    /**
     * Remove every FACE# row for a single photo (takedown cascade — a
     * deleted photo must not leave biometric data behind).
     */
    public function deleteForPhoto(int $eventId, int $photoId): void
    {
        $rows = $this->dynamo->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => $this->eventPk($eventId),
                ':sk' => 'FACE#'.$photoId.'#',
            ],
        ]);

        if ($rows === []) {
            return;
        }

        $this->dynamo->batchDelete(array_map(
            fn (array $row) => ['PK' => (string) $row['PK'], 'SK' => (string) $row['SK']],
            $rows,
        ));
    }

    public function countForEvent(int $eventId): int
    {
        return $this->dynamo->count([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => $this->eventPk($eventId),
                ':sk' => 'FACE#',
            ],
        ]);
    }
}
