<?php

return [

    /*
    |--------------------------------------------------------------------------
    | DynamoDB single-table configuration
    |--------------------------------------------------------------------------
    |
    | The whole domain model lives in one table (single-table design) with a
    | partition/sort key plus one global secondary index. See the technical
    | architecture design doc, section 3.
    |
    */

    'table' => env('DYNAMODB_TABLE', 'EventPhotoPlatform-local'),

    'region' => env('DYNAMODB_REGION', env('AWS_DEFAULT_REGION', 'ap-southeast-2')),

    // Set for local dev / CI against amazon/dynamodb-local. Leave unset in
    // production so the AWS SDK default credential provider chain (the EC2
    // instance role) is used and no static keys are needed.
    'endpoint' => env('DYNAMODB_ENDPOINT'),

    'credentials' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
    ],

    'index' => [
        'gsi1' => 'GSI1',
    ],

    // Attribute used for DynamoDB TTL expiry (epoch seconds). Password-reset
    // items set it; a JWT denylist could too.
    'ttl_attribute' => 'ttl',

];
