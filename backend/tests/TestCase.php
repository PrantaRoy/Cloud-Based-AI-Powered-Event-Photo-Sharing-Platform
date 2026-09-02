<?php

namespace Tests;

use App\Models\User;
use App\Repositories\UserRepository;
use App\Support\Dynamo\DynamoClient;
use App\Support\Jwt\JwtManager;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Hash;

abstract class TestCase extends BaseTestCase
{
    private static bool $tableReady = false;

    protected function setUp(): void
    {
        parent::setUp();

        if (! self::$tableReady) {
            $this->artisan('dynamo:create-table');
            self::$tableReady = true;
        }

        $this->truncateTable();
    }

    protected function truncateTable(): void
    {
        $dynamo = app(DynamoClient::class);
        $items = $dynamo->scan();
        $keys = array_map(fn (array $i) => ['PK' => (string) $i['PK'], 'SK' => (string) $i['SK']], $items);
        $dynamo->batchDelete($keys);
    }

    /**
     * Create a user and authenticate the next requests as them.
     *
     * @param  array{name?: string, email?: string, password?: string, role?: string}  $overrides
     */
    protected function actingAsUser(array $overrides = []): User
    {
        $user = app(UserRepository::class)->create([
            'name' => $overrides['name'] ?? 'Test User',
            'email' => $overrides['email'] ?? 'user'.uniqid().'@example.com',
            'password' => Hash::make($overrides['password'] ?? 'Password123!'),
            'role' => $overrides['role'] ?? 'visitor',
        ]);

        $this->withHeader('Authorization', 'Bearer '.app(JwtManager::class)->issue($user));

        // The `jwt` request guard memoises the resolved user; clear it so a
        // later actingAsUser() in the same test takes effect.
        $this->app['auth']->forgetGuards();

        return $user;
    }
}
