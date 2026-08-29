<?php
require_once __DIR__ . '/../api/vendor/autoload.php';

use Aws\DynamoDb\DynamoDbClient;

$endpoint = getenv('DYNAMODB_ENDPOINT') ?: 'http://localhost:8001';

$client = new DynamoDbClient([
    'region'   => 'ap-southeast-2',
    'version'  => 'latest',
    'endpoint' => $endpoint,
    'credentials' => ['key' => 'local', 'secret' => 'local'],
]);

$tables = [
    [
        'TableName' => 'Events',
        'KeySchema' => [
            ['AttributeName' => 'eventId', 'KeyType' => 'HASH'],
        ],
        'AttributeDefinitions' => [
            ['AttributeName' => 'eventId', 'AttributeType' => 'S'],
            ['AttributeName' => 'organiserId', 'AttributeType' => 'S'],
        ],
        'GlobalSecondaryIndexes' => [[
            'IndexName' => 'organiser-index',
            'KeySchema' => [['AttributeName' => 'organiserId', 'KeyType' => 'HASH']],
            'Projection' => ['ProjectionType' => 'ALL'],
            'ProvisionedThroughput' => ['ReadCapacityUnits' => 5, 'WriteCapacityUnits' => 5],
        ]],
        'ProvisionedThroughput' => ['ReadCapacityUnits' => 5, 'WriteCapacityUnits' => 5],
    ],
    [
        'TableName' => 'Photos',
        'KeySchema' => [
            ['AttributeName' => 'photoId', 'KeyType' => 'HASH'],
            ['AttributeName' => 'eventId', 'KeyType' => 'RANGE'],
        ],
        'AttributeDefinitions' => [
            ['AttributeName' => 'photoId', 'AttributeType' => 'S'],
            ['AttributeName' => 'eventId', 'AttributeType' => 'S'],
        ],
        'ProvisionedThroughput' => ['ReadCapacityUnits' => 5, 'WriteCapacityUnits' => 5],
    ],
    [
        'TableName' => 'FaceEmbeddings',
        'KeySchema' => [
            ['AttributeName' => 'userId', 'KeyType' => 'HASH'],
            ['AttributeName' => 'eventId', 'KeyType' => 'RANGE'],
        ],
        'AttributeDefinitions' => [
            ['AttributeName' => 'userId', 'AttributeType' => 'S'],
            ['AttributeName' => 'eventId', 'AttributeType' => 'S'],
        ],
        'ProvisionedThroughput' => ['ReadCapacityUnits' => 5, 'WriteCapacityUnits' => 5],
    ],
];

foreach ($tables as $def) {
    try {
        $client->createTable($def);
        echo "  ✅ Created table: {$def['TableName']}\n";
    } catch (\Aws\Exception\AwsException $e) {
        if ($e->getAwsErrorCode() === 'ResourceInUseException') {
            echo "  ⏭️  Table already exists: {$def['TableName']}\n";
        } else {
            throw $e;
        }
    }
}

// Seed one demo event
$client->putItem([
    'TableName' => 'Events',
    'Item' => [
        'eventId'          => ['S' => 'evt-demo-001'],
        'name'             => ['S' => 'Auckland Tech Meetup 2026'],
        'date'             => ['S' => '2026-09-15'],
        'venue'            => ['S' => 'GridAKL, Auckland'],
        'privacy'          => ['S' => 'Public'],
        'organiserId'      => ['S' => 'user-saleh'],
        'status'           => ['S' => 'Upcoming'],
        'participantCount' => ['N' => '0'],
        'photoCount'       => ['N' => '0'],
        'createdAt'        => ['S' => date('c')],
    ],
]);
echo "  🌱 Seeded demo event: Auckland Tech Meetup 2026\n";
