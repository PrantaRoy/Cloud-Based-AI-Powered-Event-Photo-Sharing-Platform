<?php

namespace App\Models;

use App\Concerns\GeneratesUniqueEventSlugs;
use Database\Factories\EventFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'name',
    'slug',
    'event_date',
    'venue',
    'longitude',
    'latitude',
    'privacy',
    'status',
    'start_time',
    'end_time',
    'created_by',
    'reg_auto_approve',
    'organiser_id',
    'thumbnail_s3_path',
])]
class Event extends Model
{
    /** @use HasFactory<EventFactory> */
    use GeneratesUniqueEventSlugs, HasFactory;

    public const STATUS_GROUPS = [
        'upcoming' => ['active', 'scheduled'],
        'ongoing' => ['ongoing'],
        'archived' => ['finished', 'cancelled', 'archived'],
    ];

    protected function casts(): array
    {
        return [
            'event_date' => 'datetime',
            'start_time' => 'datetime',
            'end_time' => 'datetime',
            'latitude' => 'float',
            'longitude' => 'float',
            'reg_auto_approve' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Event $event) {
            if (empty($event->slug)) {
                $event->slug = static::generateUniqueEventSlug((string) $event->name);
            }
        });
    }

    /**
     * Resolve route-model bindings by slug, falling back to the numeric id so
     * existing id-based links keep working.
     */
    public function resolveRouteBinding($value, $field = null): ?Model
    {
        return $this->where('slug', $value)
            ->when(is_numeric($value), fn (Builder $query) => $query->orWhere('id', $value))
            ->firstOrFail();
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->role === 'admin') {
            return $query;
        }

        return $query->where(function (Builder $query) use ($user) {
            $query->where('privacy', '!=', 'private')
                ->orWhere('organiser_id', $user->id)
                ->orWhereHas('participants', fn ($query) => $query->where('user_id', $user->id));
        });
    }

    public function organiser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'organiser_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(EventParticipent::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(EventMedia::class);
    }
}
