<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable([
    'event_id',
    'file_name',
    'original_s3_path',
    'thumbnail_s3_path',
    'uploaded_by',
    'processing_status',
])]
class EventMedia extends Model
{
    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function albums(): BelongsToMany
    {
        return $this->belongsToMany(Album::class, 'album_event_media')->withTimestamps()->withPivot('added_at');
    }
}
