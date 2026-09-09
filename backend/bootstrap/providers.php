<?php

use App\Providers\AppServiceProvider;
use App\Providers\AuthServiceProvider;
use App\Providers\FaceServiceProvider;
use App\Providers\RepositoryServiceProvider;
use App\Providers\RouteBindingServiceProvider;

return [
    AppServiceProvider::class,
    RepositoryServiceProvider::class,
    AuthServiceProvider::class,
    RouteBindingServiceProvider::class,
    FaceServiceProvider::class,
];
