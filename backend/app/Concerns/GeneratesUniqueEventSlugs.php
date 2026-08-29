<?php

namespace App\Concerns;

use Illuminate\Support\Str;

trait GeneratesUniqueEventSlugs
{
    /**
     * Generate a unique, hard-to-guess slug for the event.
     *
     * Readable base (from the name) + a short random suffix so the resulting
     * shareable URL is not enumerable.
     */
    protected static function generateUniqueEventSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'event';

        do {
            $slug = $base.'-'.Str::lower(Str::random(6));
        } while (static::where('slug', $slug)->exists());

        return $slug;
    }
}
