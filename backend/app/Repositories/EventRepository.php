<?php

namespace App\Repositories;

use App\Models\Event;
use App\Models\User;
use Illuminate\Support\Str;

class EventRepository extends BaseRepository
{
    private const PUBLIC_PARTITION = 'EVENTS#PUBLIC';

    public function find(int $id): ?Event
    {
        $item = $this->dynamo->getItem($this->eventPk($id), 'META');

        return $item === null ? null : Event::fromItem($item);
    }

    public function findBySlug(string $slug): ?Event
    {
        $pointer = $this->dynamo->getItem($this->slugKey($slug), 'LOCK');
        if ($pointer === null || ! isset($pointer['event_id'])) {
            return null;
        }

        return $this->find((int) $pointer['event_id']);
    }

    public function findBySlugOrId(string $value): ?Event
    {
        if (ctype_digit($value)) {
            return $this->find((int) $value) ?? $this->findBySlug($value);
        }

        return $this->findBySlug($value);
    }

    /**
     * @param  array<string, mixed>  $data  validated event fields
     */
    public function create(array $data, int $organiserId, string $organiserName, string $organiserEmail): Event
    {
        $id = $this->nextId('event');
        $now = $this->now();
        $slug = $this->uniqueSlug((string) $data['name']);
        $privacy = (string) ($data['privacy'] ?? 'public');
        $eventDate = (string) $data['event_date'];

        $meta = [
            'PK' => $this->eventPk($id),
            'SK' => 'META',
            'entity_type' => 'event',
            'id' => $id,
            'name' => $data['name'],
            'slug' => $slug,
            'event_date' => $eventDate,
            'venue' => $data['venue'],
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'privacy' => $privacy,
            'status' => $data['status'] ?? 'active',
            'start_time' => $data['start_time'] ?? null,
            'end_time' => $data['end_time'] ?? null,
            'created_by' => $organiserId,
            'organiser_id' => $organiserId,
            'reg_auto_approve' => (bool) ($data['reg_auto_approve'] ?? true),
            'thumbnail_s3_path' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        if ($privacy === 'public') {
            $meta['GSI1PK'] = self::PUBLIC_PARTITION;
            $meta['GSI1SK'] = $eventDate.'#'.$this->padId($id);
        }

        $this->dynamo->transactWrite([
            ['Put' => [
                'Item' => ['PK' => $this->slugKey($slug), 'SK' => 'LOCK', 'entity_type' => 'slug_lock', 'event_id' => $id],
                'ConditionExpression' => 'attribute_not_exists(PK)',
            ]],
            ['Put' => ['Item' => $meta]],
            ['Put' => ['Item' => [
                'PK' => $this->eventPk($id),
                'SK' => 'MEMBER#'.$organiserId,
                'GSI1PK' => $this->userPk($organiserId),
                'GSI1SK' => 'EVENT#'.$this->padId($id),
                'entity_type' => 'member',
                'event_id' => $id,
                'user_id' => $organiserId,
                'status' => 'approved',
                'is_organiser' => true,
                'registered_at' => $now,
                'approved_at' => $now,
                'email_notify' => false,
                'user_name' => $organiserName,
                'user_email' => $organiserEmail,
                'created_at' => $now,
            ]]],
        ]);

        return Event::fromItem($meta);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(int $id, array $data): Event
    {
        $current = $this->find($id);
        if ($current === null) {
            throw new \RuntimeException("Event {$id} not found");
        }

        $set = ['updated_at' => $this->now()];
        $remove = [];

        foreach (['name', 'event_date', 'venue', 'latitude', 'longitude', 'privacy', 'status', 'start_time', 'end_time', 'reg_auto_approve'] as $field) {
            if (array_key_exists($field, $data)) {
                $set[$field] = $data[$field];
            }
        }

        $newPrivacy = $data['privacy'] ?? $current->privacy;
        $newDate = $data['event_date'] ?? $current->event_date;

        if ($newPrivacy === 'public') {
            $set['GSI1PK'] = self::PUBLIC_PARTITION;
            $set['GSI1SK'] = $newDate.'#'.$this->padId($id);
        } else {
            $remove[] = 'GSI1PK';
            $remove[] = 'GSI1SK';
        }

        $item = $this->dynamo->updateItem($this->eventPk($id), 'META', $set, $remove);

        return Event::fromItem($item);
    }

    public function updateThumbnail(int $id, ?string $path): Event
    {
        $item = $this->dynamo->updateItem($this->eventPk($id), 'META', [
            'thumbnail_s3_path' => $path,
            'updated_at' => $this->now(),
        ]);

        return Event::fromItem($item);
    }

    public function delete(Event $event): void
    {
        $items = $this->dynamo->query([
            'KeyConditionExpression' => 'PK = :pk',
            'ExpressionAttributeValues' => [':pk' => $this->eventPk($event->id)],
        ]);

        $keys = array_map(fn (array $i) => ['PK' => (string) $i['PK'], 'SK' => (string) $i['SK']], $items);
        $keys[] = ['PK' => $this->slugKey($event->slug), 'SK' => 'LOCK'];

        $this->dynamo->batchDelete($keys);
    }

    /**
     * @return list<Event>
     */
    public function listPublic(): array
    {
        $items = $this->dynamo->query([
            'IndexName' => 'GSI1',
            'KeyConditionExpression' => 'GSI1PK = :pk',
            'ExpressionAttributeValues' => [':pk' => self::PUBLIC_PARTITION],
        ]);

        return array_map(fn (array $i) => Event::fromItem($i), $items);
    }

    public function countPublic(): int
    {
        return $this->dynamo->count([
            'IndexName' => 'GSI1',
            'KeyConditionExpression' => 'GSI1PK = :pk',
            'ExpressionAttributeValues' => [':pk' => self::PUBLIC_PARTITION],
        ]);
    }

    /**
     * @return list<Event>
     */
    public function listAllForAdmin(): array
    {
        $items = $this->dynamo->scan([
            'FilterExpression' => 'entity_type = :t',
            'ExpressionAttributeValues' => [':t' => 'event'],
        ]);

        return array_map(fn (array $i) => Event::fromItem($i), $items);
    }

    /**
     * @param  array<int, int|string>  $ids
     * @return list<Event>
     */
    public function findMany(array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if ($ids === []) {
            return [];
        }

        $keys = array_map(fn (int $id) => ['PK' => $this->eventPk($id), 'SK' => 'META'], $ids);

        return array_map(fn (array $i) => Event::fromItem($i), $this->dynamo->batchGet($keys));
    }

    /**
     * Populate organiser/creator summaries and participant/media counts.
     *
     * @param  list<Event>  $events
     * @param  array<int, User>  $userCache  optional pre-loaded users keyed by id
     * @return list<Event>
     */
    public function hydrate(array $events, array $userCache = []): array
    {
        $ids = [];
        foreach ($events as $event) {
            $ids[] = $event->organiser_id;
            $ids[] = $event->created_by;
        }
        $ids = array_values(array_diff(array_unique($ids), array_keys($userCache)));

        $users = $userCache + app(UserRepository::class)->findMany($ids);

        foreach ($events as $event) {
            $event->organiser = isset($users[$event->organiser_id]) ? $users[$event->organiser_id]->summary() : null;
            $event->creator = isset($users[$event->created_by]) ? $users[$event->created_by]->summary() : null;
            $this->withCounts($event);
        }

        return $events;
    }

    public function withCounts(Event $event): Event
    {
        $event->participants_count = $this->dynamo->count([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [':pk' => $this->eventPk($event->id), ':sk' => 'MEMBER#'],
        ]);
        $event->media_count = $this->dynamo->count([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [':pk' => $this->eventPk($event->id), ':sk' => 'PHOTO#'],
        ]);

        return $event;
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'event';

        do {
            $slug = $base.'-'.Str::lower(Str::random(6));
        } while ($this->dynamo->getItem($this->slugKey($slug), 'LOCK') !== null);

        return $slug;
    }

    private function padId(int $id): string
    {
        return str_pad((string) $id, 12, '0', STR_PAD_LEFT);
    }
}
