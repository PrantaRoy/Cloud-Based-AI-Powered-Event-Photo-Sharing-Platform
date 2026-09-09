<?php

namespace App\Repositories;

use App\Models\EventParticipent;

class MemberRepository extends BaseRepository
{
    public function find(int $eventId, int $userId): ?EventParticipent
    {
        $item = $this->dynamo->getItem($this->eventPk($eventId), 'MEMBER#'.$userId);

        return $item === null ? null : EventParticipent::fromItem($item);
    }

    /**
     * @return list<EventParticipent>
     */
    public function listForEvent(int $eventId): array
    {
        $items = $this->dynamo->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [':pk' => $this->eventPk($eventId), ':sk' => 'MEMBER#'],
        ]);

        return array_map(fn (array $i) => EventParticipent::fromItem($i), $items);
    }

    /**
     * Membership rows for a user, across events (GSI1 USER#<id> partition).
     *
     * @return list<array<string, mixed>> raw items (carry event_id, status, is_organiser)
     */
    public function listForUser(int $userId): array
    {
        return $this->dynamo->query([
            'IndexName' => 'GSI1',
            'KeyConditionExpression' => 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
            'ExpressionAttributeValues' => [':pk' => $this->userPk($userId), ':sk' => 'EVENT#'],
        ]);
    }

    public function create(int $eventId, int $userId, string $status, bool $emailNotify, string $userName, string $userEmail): EventParticipent
    {
        $now = $this->now();
        $item = [
            'PK' => $this->eventPk($eventId),
            'SK' => 'MEMBER#'.$userId,
            'GSI1PK' => $this->userPk($userId),
            'GSI1SK' => 'EVENT#'.str_pad((string) $eventId, 12, '0', STR_PAD_LEFT),
            'entity_type' => 'member',
            'event_id' => $eventId,
            'user_id' => $userId,
            'status' => $status,
            'is_organiser' => false,
            'registered_at' => $now,
            'approved_at' => $status === 'approved' ? $now : null,
            'email_notify' => $emailNotify,
            'user_name' => $userName,
            'user_email' => $userEmail,
            'created_at' => $now,
        ];

        $this->dynamo->putItem($item, 'attribute_not_exists(PK) AND attribute_not_exists(SK)');

        return EventParticipent::fromItem($item);
    }

    public function updateStatus(int $eventId, int $userId, string $status): EventParticipent
    {
        $item = $this->dynamo->updateItem($this->eventPk($eventId), 'MEMBER#'.$userId, [
            'status' => $status,
            'approved_at' => $status === 'approved' ? $this->now() : null,
        ]);

        return EventParticipent::fromItem($item);
    }

    /**
     * Has this member granted consent for facial matching on this event?
     * Consent is captured the first time they run a selfie search.
     */
    public function hasFacialMatchingConsent(int $eventId, int $userId): bool
    {
        $member = $this->find($eventId, $userId);

        return $member !== null && $member->consent_facial_matching === true;
    }

    /**
     * Record (or withdraw) facial-matching consent on the MEMBER# item.
     * Stores a timestamp when granted; clears it when withdrawn.
     */
    public function setFacialMatchingConsent(int $eventId, int $userId, bool $granted): void
    {
        if ($granted) {
            $this->dynamo->updateItem($this->eventPk($eventId), 'MEMBER#'.$userId, [
                'consent_facial_matching' => true,
                'consent_facial_matching_at' => $this->now(),
            ]);

            return;
        }

        $this->dynamo->updateItem(
            $this->eventPk($eventId),
            'MEMBER#'.$userId,
            ['consent_facial_matching' => false],
            ['consent_facial_matching_at'],
        );
    }

    public function isApprovedParticipant(int $eventId, int $userId): bool
    {
        $member = $this->find($eventId, $userId);

        return $member !== null && $member->status === 'approved';
    }

    public function isMember(int $eventId, int $userId): bool
    {
        return $this->find($eventId, $userId) !== null;
    }

    public function countApprovedGlobal(): int
    {
        return $this->dynamo->scanCount([
            'FilterExpression' => 'entity_type = :t AND #s = :s',
            'ExpressionAttributeNames' => ['#s' => 'status'],
            'ExpressionAttributeValues' => [':t' => 'member', ':s' => 'approved'],
        ]);
    }
}
