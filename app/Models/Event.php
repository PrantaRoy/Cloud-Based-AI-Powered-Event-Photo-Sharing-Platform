<?php

namespace App\Models;

use Database\Factories\EventFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'name',
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
])]
class Event extends Model
{
    /** @use HasFactory<EventFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'event_date' => 'datetime',
            'start_time' => 'datetime',
            'end_time' => 'datetime',
            'reg_auto_approve' => 'boolean',
        ];
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
