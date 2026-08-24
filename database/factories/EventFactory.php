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
        $eventDate = fake()->dateTimeBetween('+1 week', '+6 months');
        $startTime = (clone $eventDate)->modify('+'.fake()->numberBetween(0, 4).' hours');
        $endTime = (clone $startTime)->modify('+'.fake()->numberBetween(1, 6).' hours');

        return [
            'name' => fake()->catchPhrase(),
            'event_date' => $eventDate,
            'venue' => fake()->address(),
            'longitude' => null,
            'latitude' => null,
            'privacy' => 'public',
            'status' => 'scheduled',
            'start_time' => $startTime,
            'end_time' => $endTime,
            'created_by' => User::factory(),
            'reg_auto_approve' => fake()->boolean(),
            'organiser_id' => User::factory(),
        ];
    }
}
