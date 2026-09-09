<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Amazon Cognito
    |--------------------------------------------------------------------------
    |
    | When COGNITO_USER_POOL_ID is set, the app authenticates through a Cognito
    | user pool (sign-up, email, password policy, JWT issuance) instead of the
    | built-in local JWT. Leave it blank for local/Docker/CI (local mode).
    | Credentials come from the EC2 instance role — no keys here.
    |
    */

    'cognito' => [
        'region' => env('COGNITO_REGION', env('AWS_DEFAULT_REGION', 'ap-southeast-2')),
        'user_pool_id' => env('COGNITO_USER_POOL_ID'),
        'client_id' => env('COGNITO_CLIENT_ID'),
        'client_secret' => env('COGNITO_CLIENT_SECRET'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Face matching (open-source dlib / face_recognition Lambda pipeline)
    |--------------------------------------------------------------------------
    |
    | Leave FACE_SEARCH_LAMBDA_NAME / FACE_INDEX_QUEUE_URL blank for
    | local / Docker / CI: uploads skip face indexing and the selfie search
    | endpoint degrades to a "unavailable" response (consent is still
    | enforced). In AWS these point at the deployed SQS queue + search Lambda.
    | Credentials come from the EC2 instance role — no keys here.
    |
    */

    'face' => [
        'region' => env('FACE_AWS_REGION', env('AWS_DEFAULT_REGION', 'ap-southeast-2')),
        'search_lambda' => env('FACE_SEARCH_LAMBDA_NAME'),
        'index_queue_url' => env('FACE_INDEX_QUEUE_URL'),
        'match_threshold' => (float) env('FACE_MATCH_THRESHOLD', 0.55),
        'selfie_disk' => env('FACE_SELFIE_DISK', env('FILESYSTEM_DISK', 's3')),
        'selfie_prefix' => env('FACE_SELFIE_PREFIX', 'tmp/selfies'),
        // Explicit keys for local / CI only; blank in AWS (EC2 instance role).
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        // Local Docker path: an HTTP face-worker instead of SQS/Lambda.
        // When set, it takes precedence over the AWS transport above.
        'local_url' => env('FACE_LOCAL_URL'),
        // Where the worker fetches photos/selfies (the API's public /storage).
        'image_base_url' => env('FACE_IMAGE_BASE_URL'),
    ],

];
