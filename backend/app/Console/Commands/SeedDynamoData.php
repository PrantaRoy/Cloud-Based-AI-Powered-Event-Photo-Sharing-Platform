<?php

namespace App\Console\Commands;

use App\Repositories\EventRepository;
use App\Repositories\MemberRepository;
use App\Repositories\PhotoRepository;
use App\Repositories\UserRepository;
use App\Support\Dynamo\DynamoClient;
use Carbon\CarbonImmutable;
use Faker\Factory as FakerFactory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SeedDynamoData extends Command
{
    protected $signature = 'dynamo:seed {--fresh : Wipe the table before seeding}';

    protected $description = 'Load demo data (admin + organisers + visitors + events + participants + photos).';

    public function handle(
        DynamoClient $dynamo,
        UserRepository $users,
        EventRepository $events,
        MemberRepository $members,
        PhotoRepository $photos,
    ): int {
        if ($this->option('fresh')) {
            $this->wipe($dynamo);
            $this->info('Table wiped.');
        }

        $faker = FakerFactory::create();

        $admin = $users->create([
            'name' => 'Admin',
            'email' => 'admin@eventpro.com',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);
        $this->line("admin@eventpro.com / password  (id {$admin->id})");

        $organisers = [];
        for ($i = 0; $i < 6; $i++) {
            $organisers[] = $users->create([
                'name' => $faker->name(),
                'email' => $faker->unique()->safeEmail(),
                'password' => Hash::make('password'),
                'role' => 'organiser',
            ]);
        }

        $visitors = [];
        for ($i = 0; $i < 40; $i++) {
            $visitors[] = $users->create([
                'name' => $faker->name(),
                'email' => $faker->unique()->safeEmail(),
                'password' => Hash::make('password'),
                'role' => 'visitor',
            ]);
        }
        $this->info('Users: 1 admin, '.count($organisers).' organisers, '.count($visitors).' visitors.');

        $buckets = [
            ['count' => 4, 'status' => 'active', 'from' => '+2 hours', 'to' => '+22 hours'],
            ['count' => 6, 'status' => 'scheduled', 'from' => '+2 days', 'to' => '+3 weeks'],
            ['count' => 5, 'status' => 'scheduled', 'from' => '+1 month', 'to' => '+4 months'],
            ['count' => 3, 'status' => 'ongoing', 'from' => '-3 hours', 'to' => '-30 minutes'],
            ['count' => 4, 'status' => 'finished', 'from' => '-2 months', 'to' => '-4 days'],
        ];

        $eventCount = 0;
        foreach ($buckets as $bucket) {
            for ($i = 0; $i < $bucket['count']; $i++) {
                $org = $faker->randomElement($organisers);
                $date = CarbonImmutable::parse($faker->dateTimeBetween($bucket['from'], $bucket['to']));
                $located = $faker->boolean(35);

                $event = $events->create([
                    'name' => rtrim($faker->sentence(3), '.'),
                    'event_date' => $date->toIso8601String(),
                    'venue' => $faker->city().' '.$faker->randomElement(['Convention Centre', 'Town Hall', 'Stadium', 'Gallery', 'Park']),
                    'latitude' => $located ? $faker->latitude(-47, -34) : null,
                    'longitude' => $located ? $faker->longitude(166, 178) : null,
                    'privacy' => 'public',
                    'status' => $bucket['status'],
                    'start_time' => $date->toIso8601String(),
                    'end_time' => $date->addHours($faker->numberBetween(2, 6))->toIso8601String(),
                    'reg_auto_approve' => $faker->boolean(80),
                ], $org->id, $org->name, $org->email);
                $eventCount++;

                $attendees = $faker->randomElements($visitors, $faker->numberBetween(5, 18));
                foreach ($attendees as $visitor) {
                    $members->create(
                        $event->id,
                        $visitor->id,
                        $faker->boolean(85) ? 'approved' : 'pending',
                        $faker->boolean(),
                        $visitor->name,
                        $visitor->email,
                    );
                }

                $photoCount = $bucket['status'] === 'finished' ? $faker->numberBetween(10, 25) : $faker->numberBetween(0, 8);
                for ($p = 0; $p < $photoCount; $p++) {
                    $uploader = $faker->randomElement($attendees);
                    $photos->create(
                        $event->id,
                        'IMG_'.$faker->numerify('####').'.jpg',
                        "event-media/{$event->id}/".Str::uuid()->toString().'.jpg',
                        $uploader->id,
                    );
                }
            }
        }

        foreach (['private', 'private', 'protected'] as $privacy) {
            $org = $faker->randomElement($organisers);
            $date = CarbonImmutable::parse($faker->dateTimeBetween('+1 week', '+2 months'));
            $events->create([
                'name' => rtrim($faker->sentence(3), '.'),
                'event_date' => $date->toIso8601String(),
                'venue' => $faker->city(),
                'privacy' => $privacy,
                'status' => 'scheduled',
                'reg_auto_approve' => $privacy === 'private',
            ], $org->id, $org->name, $org->email);
            $eventCount++;
        }

        $this->info("Events: {$eventCount}.");
        $this->info('Done.');

        return self::SUCCESS;
    }

    private function wipe(DynamoClient $dynamo): void
    {
        $items = $dynamo->scan();
        $keys = array_map(fn (array $i) => ['PK' => (string) $i['PK'], 'SK' => (string) $i['SK']], $items);
        $dynamo->batchDelete($keys);
    }
}
