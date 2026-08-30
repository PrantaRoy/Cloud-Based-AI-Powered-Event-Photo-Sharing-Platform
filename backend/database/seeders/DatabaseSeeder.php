<?php

namespace Database\Seeders;

use App\Models\Event;
use App\Models\EventMedia;
use App\Models\EventMediaMatchedUser;
use App\Models\EventParticipent;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::factory()->create([
            'name' => 'Admin',
            'email' => 'admin@eventpro.com',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);

        $organisers = User::factory()->count(10)->create(['role' => 'organiser']);
        $visitors = User::factory()->count(90)->create(['role' => 'visitor']);

        $next = 0;
        $organiser = fn () => $organisers[$next++ % $organisers->count()];

        // Public events spread across time so every landing-page section has
        // something to show. ~1/3 are pinned to a location.
        $make = function (int $count, ?callable $configure = null) use ($organiser) {
            for ($i = 0; $i < $count; $i++) {
                $factory = Event::factory();
                if ($configure) {
                    $factory = $configure($factory);
                }
                if (fake()->boolean(35)) {
                    $factory = $factory->located();
                }
                $org = $organiser();
                $factory->create(['organiser_id' => $org->id, 'created_by' => $org->id]);
            }
        };

        $make(4, fn ($f) => $f->soon());
        $make(6, fn ($f) => $f->thisWeek());
        $make(8);
        $make(3, fn ($f) => $f->ongoing());
        $make(4, fn ($f) => $f->finished());

        foreach (['private', 'private', 'private', 'protected', 'protected'] as $privacy) {
            $org = $organiser();
            Event::factory()->create([
                'privacy' => $privacy,
                'organiser_id' => $org->id,
                'created_by' => $org->id,
            ]);
        }

        // Slug hook is muted by WithoutModelEvents — backfill.
        Event::whereNull('slug')->orWhere('slug', '')->get()->each(function (Event $event) {
            do {
                $slug = (Str::slug($event->name) ?: 'event').'-'.Str::lower(Str::random(6));
            } while (Event::where('slug', $slug)->exists());
            $event->forceFill(['slug' => $slug])->save();
        });

        // Attendance + photos + face matches, so the public counters and event
        // cards show realistic numbers.
        foreach (Event::where('privacy', 'public')->get() as $event) {
            $attendees = $visitors->shuffle()->take(fake()->numberBetween(6, 20));

            foreach ($attendees as $user) {
                $registeredAt = now()->subDays(fake()->numberBetween(1, 25));
                EventParticipent::create([
                    'event_id' => $event->id,
                    'user_id' => $user->id,
                    'status' => fake()->boolean(85) ? 'approved' : 'pending',
                    'registered_at' => $registeredAt,
                    'approved_at' => $registeredAt->copy()->addDays(fake()->numberBetween(0, 3)),
                    'email_notify' => fake()->boolean(),
                ]);
            }

            $photoCount = $event->status === 'finished'
                ? fake()->numberBetween(12, 40)
                : fake()->numberBetween(0, 14);

            for ($p = 0; $p < $photoCount; $p++) {
                $media = EventMedia::create([
                    'event_id' => $event->id,
                    'file_name' => 'IMG_'.fake()->numerify('####').'.jpg',
                    'original_s3_path' => "event-media/{$event->id}/".Str::uuid()->toString().'.jpg',
                    'uploaded_by' => $attendees->random()->id,
                    'processing_status' => 'completed',
                ]);

                foreach ($attendees->shuffle()->take(fake()->numberBetween(0, 4)) as $matched) {
                    EventMediaMatchedUser::forceCreate([
                        'event_media_id' => $media->id,
                        'user_id' => $matched->id,
                        'match_status' => 'matched',
                        'matched_at' => now(),
                    ]);
                }
            }
        }
    }
}
