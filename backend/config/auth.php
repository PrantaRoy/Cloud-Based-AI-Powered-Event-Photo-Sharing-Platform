<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Authentication Defaults
    |--------------------------------------------------------------------------
    |
    | Stateless JWT bearer-token auth for the API (see App\Providers\
    | AuthServiceProvider, which registers the `jwt` request guard). There is
    | no session guard and no relational user provider — users are loaded from
    | DynamoDB via App\Repositories\UserRepository.
    |
    */

    'defaults' => [
        'guard' => env('AUTH_GUARD', 'api'),
    ],

    'guards' => [
        'api' => [
            'driver' => 'jwt',
        ],
    ],

    'password_timeout' => env('AUTH_PASSWORD_TIMEOUT', 10800),

];
