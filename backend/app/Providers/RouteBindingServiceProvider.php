<?php

namespace App\Providers;

use App\Models\Event;
use App\Repositories\AlbumRepository;
use App\Repositories\EventRepository;
use App\Repositories\MemberRepository;
use App\Repositories\PhotoRepository;
use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/**
 * Explicit route-model bindings backed by the DynamoDB repositories
 * (there is no Eloquent implicit binding any more).
 */
class RouteBindingServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Route::bind('event', fn (string $value) => app(EventRepository::class)->findBySlugOrId($value)
            ?? abort(404, 'Event not found'));

        Route::bind('album', fn (string $value) => app(AlbumRepository::class)->find((int) $value)
            ?? abort(404, 'Album not found'));

        Route::bind('media', fn (string $value) => app(PhotoRepository::class)->find((int) $value)
            ?? abort(404, 'Photo not found'));

        Route::bind('participant', function (string $value, RoutingRoute $route) {
            $event = $route->parameter('event');

            if (! $event instanceof Event) {
                abort(404, 'Event not found');
            }

            return app(MemberRepository::class)->find($event->id, (int) $value)
                ?? abort(404, 'Participant not found');
        });
    }
}
