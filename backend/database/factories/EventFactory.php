<?php

namespace Database\Factories;

use App\Models\Event;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Event>
 */
class EventFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $eventDate = fake()->dateTimeBetween('now', '+4 months');

        return [
            'name' => fake()->catchPhrase(),
            ...$this->timing($eventDate),
            'venue' => fake()->address(),
            'longitude' => null,
            'latitude' => null,
            'privacy' => 'public',
            'status' => 'scheduled',
            'created_by' => User::factory(),
            'reg_auto_approve' => fake()->boolean(),
            'organiser_id' => User::factory(),
        ];
    }

    /**
     * Consistent event_date / start_time / end_time triple for a given date.
     *
     * @return array<string, \DateTimeInterface>
     */
    private function timing(\DateTimeInterface $eventDate): array
    {
        $startTime = (clone $eventDate)->modify('+'.fake()->numberBetween(0, 4).' hours');
        $endTime = (clone $startTime)->modify('+'.fake()->numberBetween(1, 6).' hours');

        return [
            'event_date' => $eventDate,
            'start_time' => $startTime,
            'end_time' => $endTime,
        ];
    }

    /** Happening within the next day. */
    public function soon(): static
    {
        return $this->state(fn () => $this->timing(fake()->dateTimeBetween('+2 hours', '+22 hours')));
    }

    /** Happening later this week. */
    public function thisWeek(): static
    {
        return $this->state(fn () => $this->timing(fake()->dateTimeBetween('+1 day', '+6 days')));
    }

    /** Currently in progress. */
    public function ongoing(): static
    {
        $start = fake()->dateTimeBetween('-3 hours', '-30 minutes');

        return $this->state(fn () => [
            'status' => 'ongoing',
            'event_date' => $start,
            'start_time' => $start,
            'end_time' => (clone $start)->modify('+'.fake()->numberBetween(2, 6).' hours'),
        ]);
    }

    /** Already wrapped up. */
    public function finished(): static
    {
        return $this->state(fn () => [
            'status' => 'finished',
            ...$this->timing(fake()->dateTimeBetween('-2 months', '-3 days')),
        ]);
    }

    /** Pin the event to a real-ish spot inside the continental US. */
    public function located(): static
    {
        return $this->state(fn () => [
            'latitude' => fake()->latitude(25, 48),
            'longitude' => fake()->longitude(-123, -71),
        ]);
    }
}
