<?php

namespace App\Providers;

use App\Auth\AuthBroker;
use App\Auth\CognitoAuthBroker;
use App\Auth\LocalAuthBroker;
use App\Models\Album;
use App\Models\Event;
use App\Policies\AlbumPolicy;
use App\Policies\EventPolicy;
use App\Repositories\UserRepository;
use App\Support\Cognito\CognitoTokenVerifier;
use App\Support\Jwt\JwtManager;
use Aws\CognitoIdentityProvider\CognitoIdentityProviderClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(JwtManager::class, fn ($app) => new JwtManager(
            (string) $app['config']->get('app.jwt_secret'),
            (int) $app['config']->get('app.jwt_ttl_days', 7),
        ));

        $this->app->singleton(CognitoTokenVerifier::class, fn ($app) => new CognitoTokenVerifier(
            (string) $app['config']->get('services.cognito.region'),
            (string) $app['config']->get('services.cognito.user_pool_id'),
            (string) $app['config']->get('services.cognito.client_id'),
        ));

        $this->app->singleton(CognitoIdentityProviderClient::class, fn ($app) => new CognitoIdentityProviderClient([
            'region' => (string) $app['config']->get('services.cognito.region'),
            'version' => '2016-04-18',
        ]));

        $this->app->singleton(CognitoAuthBroker::class, fn ($app) => new CognitoAuthBroker(
            $app->make(CognitoIdentityProviderClient::class),
            $app->make(CognitoTokenVerifier::class),
            $app->make(UserRepository::class),
            (string) $app['config']->get('services.cognito.user_pool_id'),
            (string) $app['config']->get('services.cognito.client_id'),
            (string) $app['config']->get('services.cognito.client_secret'),
        ));

        // Cognito when a user pool is configured, otherwise the built-in local JWT.
        $this->app->singleton(AuthBroker::class, fn ($app) => $app['config']->get('services.cognito.user_pool_id')
            ? $app->make(CognitoAuthBroker::class)
            : $app->make(LocalAuthBroker::class));
    }

    public function boot(): void
    {
        Gate::policy(Event::class, EventPolicy::class);
        Gate::policy(Album::class, AlbumPolicy::class);

        Auth::viaRequest('jwt', function (Request $request): ?object {
            $bearer = $request->bearerToken();

            return $bearer ? app(AuthBroker::class)->resolveToken($bearer) : null;
        });
    }
}
