<?php

namespace App\Providers;

use App\Models\Album;
use App\Models\Event;
use App\Policies\AlbumPolicy;
use App\Policies\EventPolicy;
use App\Repositories\UserRepository;
use App\Support\Jwt\JwtManager;
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
    }

    public function boot(): void
    {
        Gate::policy(Event::class, EventPolicy::class);
        Gate::policy(Album::class, AlbumPolicy::class);

        Auth::viaRequest('jwt', function (Request $request): ?object {
            $bearer = $request->bearerToken();
            if (! $bearer) {
                return null;
            }

            try {
                $payload = app(JwtManager::class)->parse($bearer);
            } catch (\Throwable) {
                return null;
            }

            return app(UserRepository::class)->find($payload['sub']);
        });
    }
}
