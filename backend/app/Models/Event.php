<?php

namespace App\Models;

/**
 * Plain data object hydrated from a DynamoDB `EVENT#<id> / META` item.
 * Persistence lives in App\Repositories\EventRepository.
 */
class Event
{
    /** Maps the frontend status-group filter to concrete status values. */
    public const STATUS_GROUPS = [
        'upcoming' => ['active', 'scheduled'],
        'ongoing' => ['ongoing'],
        'archived' => ['finished', 'cancelled', 'archived'],
    ];

    public int $id;

    public string $name;

    public string $slug;

    public string $event_date;

    public string $venue;

    public ?float $latitude = null;

    public ?float $longitude = null;

    public string $privacy = 'public';

    public string $status = 'active';

    public ?string $start_time = null;

    public ?string $end_time = null;

    public int $created_by;

    public int $organiser_id;

    public bool $reg_auto_approve = true;

    public ?string $thumbnail_s3_path = null;

    public ?string $created_at = null;

    public ?string $updated_at = null;

    // --- hydrated extras (populated by the repository, never persisted) ---

    /** @var array{id: int, name: string, email: string}|null */
    public ?array $organiser = null;

    /** @var array{id: int, name: string, email: string}|null */
    public ?array $creator = null;

    public int $participants_count = 0;

    public int $media_count = 0;

    public ?string $my_registered_at = null;

    public ?string $my_status = null;

    public ?float $distance_km = null;

    /**
     * @param  array<string, mixed>  $item
     */
    public static function fromItem(array $item): self
    {
        $event = new self;
        $event->id = (int) $item['id'];
        $event->name = (string) $item['name'];
        $event->slug = (string) $item['slug'];
        $event->event_date = (string) $item['event_date'];
        $event->venue = (string) $item['venue'];
        $event->latitude = isset($item['latitude']) ? (float) $item['latitude'] : null;
        $event->longitude = isset($item['longitude']) ? (float) $item['longitude'] : null;
        $event->privacy = (string) ($item['privacy'] ?? 'public');
        $event->status = (string) ($item['status'] ?? 'active');
        $event->start_time = $item['start_time'] ?? null;
        $event->end_time = $item['end_time'] ?? null;
        $event->created_by = (int) $item['created_by'];
        $event->organiser_id = (int) $item['organiser_id'];
        $event->reg_auto_approve = (bool) ($item['reg_auto_approve'] ?? true);
        $event->thumbnail_s3_path = $item['thumbnail_s3_path'] ?? null;
        $event->created_at = $item['created_at'] ?? null;
        $event->updated_at = $item['updated_at'] ?? null;

        return $event;
    }
}
