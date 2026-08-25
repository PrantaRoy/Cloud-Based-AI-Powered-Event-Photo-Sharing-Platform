<?php

namespace Database\Seeders;

use App\Models\Event;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

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

        User::factory()->count(90)->create(['role' => 'visitor']);

        $privacies = [
            ...array_fill(0, 20, 'public'),
            ...array_fill(0, 5, 'private'),
            ...array_fill(0, 5, 'protected'),
        ];
        shuffle($privacies);

        foreach ($privacies as $index => $privacy) {
            $organiser = $organisers[$index % 10];

            Event::factory()->create([
                'privacy' => $privacy,
                'organiser_id' => $organiser->id,
                'created_by' => $organiser->id,
            ]);
        }
    }
}
