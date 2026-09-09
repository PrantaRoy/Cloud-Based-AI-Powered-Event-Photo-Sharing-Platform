<?php

namespace App\Repositories;

/**
 * Persisted selfie-search results, so "my matched photos" is a cheap read
 * rather than a re-run of the Lambda search each time the gallery opens.
 *
 * Written by Laravel from the search Lambda's response (the Lambda itself
 * stays read-only on DynamoDB).
 *
 *   PK          = USER#<userId>
 *   SK          = MATCH#<eventId>#<photoId>
 *   entity_type = photo_match
 *   distance    = string (Euclidean distance, smaller = closer)
 */
class FaceMatchRepository extends BaseRepository
{
    /**
     * @return list<array<string, mixed>> raw items (carry photo_id, distance)
     */
    public function listForUserEvent(int $userId, int $eventId): array
    {
        return $this->dynamo->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => $this->userPk($userId),
                ':sk' => 'MATCH#'.$eventId.'#',
            ],
        ]);
    }

    /**
     * Replace all stored matches for one user + event with a fresh set.
     *
     * @param  list<array{photo_id: int, distance: float|string}>  $matches
     */
    public function replaceForUserEvent(int $userId, int $eventId, array $matches): void
    {
        $this->deleteForUserEvent($userId, $eventId);

        $now = $this->now();
        foreach ($matches as $match) {
            $photoId = (int) $match['photo_id'];
            $this->dynamo->putItem([
                'PK' => $this->userPk($userId),
                'SK' => 'MATCH#'.$eventId.'#'.$photoId,
                'entity_type' => 'photo_match',
                'event_id' => $eventId,
                'photo_id' => $photoId,
                'distance' => (string) round((float) $match['distance'], 4),
                'matched_at' => $now,
            ]);
        }
    }

    public function deleteForUserEvent(int $userId, int $eventId): void
    {
        $rows = $this->listForUserEvent($userId, $eventId);

        if ($rows === []) {
            return;
        }

        $this->dynamo->batchDelete(array_map(
            fn (array $row) => ['PK' => (string) $row['PK'], 'SK' => (string) $row['SK']],
            $rows,
        ));
    }
}
