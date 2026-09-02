<?php

namespace App\Providers;

use App\Support\Dynamo\DynamoClient;
use Illuminate\Support\ServiceProvider;

class RepositoryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(DynamoClient::class, function ($app) {
            /** @var array<string, mixed> $config */
            $config = $app['config']->get('dynamodb');

            return new DynamoClient($config);
        });

        // Repository classes take only DynamoClient as a constructor
        // dependency, so the container resolves them automatically.
    }
}
