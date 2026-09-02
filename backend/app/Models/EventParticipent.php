<?php

namespace App\Models;

/**
 * Plain data object hydrated from a DynamoDB `EVENT#<id> / MEMBER#<userId>`
 * item (an event membership / participant record).
 * Persistence lives in App\Repositories\MemberRepository.
 *
 * There is no separate surrogate key — `id` mirrors `user_id`, which is what
 * the frontend uses to address a participant row.
 */
class EventParticipent
{
    public int $id;

    public int $event_id;

    public int $user_id;

    public string $status = 'pending';

    public ?string $registered_at = null;

    public ?string $approved_at = null;

    public bool $email_notify = false;

    public ?string $created_at = null;

    /** @var array{id: int, name: string, email: string}|null */
    public ?array $user = null;

    /**
     * @param  array<string, mixed>  $item
     */
    public static function fromItem(array $item): self
    {
        $member = new self;
        $member->user_id = (int) $item['user_id'];
        $member->id = (int) $item['user_id'];
        $member->event_id = (int) $item['event_id'];
        $member->status = (string) ($item['status'] ?? 'pending');
        $member->registered_at = $item['registered_at'] ?? null;
        $member->approved_at = $item['approved_at'] ?? null;
        $member->email_notify = (bool) ($item['email_notify'] ?? false);
        $member->created_at = $item['created_at'] ?? null;

        if (isset($item['user_name'])) {
            $member->user = [
                'id' => (int) $item['user_id'],
                'name' => (string) $item['user_name'],
                'email' => (string) ($item['user_email'] ?? ''),
            ];
        }

        return $member;
    }
}
