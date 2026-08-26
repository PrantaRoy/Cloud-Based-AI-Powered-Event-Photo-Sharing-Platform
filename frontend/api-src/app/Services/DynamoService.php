<?php
namespace App\Services;

use Aws\DynamoDb\DynamoDbClient;
use Aws\DynamoDb\Marshaler;

class DynamoService
{
    protected DynamoDbClient $client;
    protected Marshaler $marshaler;

    public function __construct()
    {
        $config = [
            'region'  => env('AWS_DEFAULT_REGION', 'ap-southeast-2'),
            'version' => 'latest',
            'credentials' => [
                'key'    => env('AWS_ACCESS_KEY_ID', 'local'),
                'secret' => env('AWS_SECRET_ACCESS_KEY', 'local'),
            ],
        ];

        // Use local endpoint in dev
        if ($endpoint = env('DYNAMODB_ENDPOINT')) {
            $config['endpoint'] = $endpoint;
        }

        $this->client    = new DynamoDbClient($config);
        $this->marshaler = new Marshaler();
    }

    /** Get all events (scan – fine for local dev, use Query+GSI in prod) */
    public function listEvents(array $filters = []): array
    {
        $params = ['TableName' => 'Events'];

        if (!empty($filters['organiserId'])) {
            $params['IndexName'] = 'organiser-index';
            $params['KeyConditionExpression'] = 'organiserId = :oid';
            $params['ExpressionAttributeValues'] = [
                ':oid' => ['S' => $filters['organiserId']],
            ];
            $result = $this->client->query($params);
        } else {
            $result = $this->client->scan($params);
        }

        return array_map(
            fn($item) => $this->marshaler->unmarshalItem($item),
            $result['Items']
        );
    }

    public function getEvent(string $eventId): ?array
    {
        $result = $this->client->getItem([
            'TableName' => 'Events',
            'Key' => ['eventId' => ['S' => $eventId]],
        ]);
        return isset($result['Item'])
            ? $this->marshaler->unmarshalItem($result['Item'])
            : null;
    }

    public function putEvent(array $data): void
    {
        $this->client->putItem([
            'TableName' => 'Events',
            'Item' => $this->marshaler->marshalItem($data),
        ]);
    }

    public function putPhoto(array $data): void
    {
        $this->client->putItem([
            'TableName' => 'Photos',
            'Item' => $this->marshaler->marshalItem($data),
        ]);
    }

    public function getPhotosByEvent(string $eventId): array
    {
        $result = $this->client->query([
            'TableName' => 'Photos',
            'IndexName' => 'event-index',
            'KeyConditionExpression' => 'eventId = :eid',
            'ExpressionAttributeValues' => [':eid' => ['S' => $eventId]],
        ]);
        return array_map(
            fn($item) => $this->marshaler->unmarshalItem($item),
            $result['Items']
        );
    }

    public function putEmbedding(array $data): void
    {
        $this->client->putItem([
            'TableName' => 'FaceEmbeddings',
            'Item' => $this->marshaler->marshalItem($data),
        ]);
    }

    public function getEmbeddings(string $eventId): array
    {
        $result = $this->client->scan([
            'TableName'        => 'FaceEmbeddings',
            'FilterExpression' => 'eventId = :eid',
            'ExpressionAttributeValues' => [':eid' => ['S' => $eventId]],
        ]);
        return array_map(
            fn($item) => $this->marshaler->unmarshalItem($item),
            $result['Items']
        );
    }
}
