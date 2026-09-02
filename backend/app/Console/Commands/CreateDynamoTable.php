<?php

namespace App\Console\Commands;

use App\Support\Dynamo\DynamoClient;
use Aws\DynamoDb\Exception\DynamoDbException;
use Illuminate\Console\Command;

class CreateDynamoTable extends Command
{
    protected $signature = 'dynamo:create-table {--drop : Delete the table first (destructive)}';

    protected $description = 'Create the single-table DynamoDB table (PK/SK + GSI1 + TTL). Idempotent.';

    public function handle(DynamoClient $dynamo): int
    {
        $client = $dynamo->raw();
        $table = $dynamo->tableName();

        if ($this->option('drop')) {
            try {
                $client->deleteTable(['TableName' => $table]);
                $client->waitUntil('TableNotExists', ['TableName' => $table]);
                $this->warn("Dropped table {$table}.");
            } catch (DynamoDbException $e) {
                if ($e->getAwsErrorCode() !== 'ResourceNotFoundException') {
                    throw $e;
                }
            }
        }

        try {
            $client->createTable([
                'TableName' => $table,
                'BillingMode' => 'PAY_PER_REQUEST',
                'AttributeDefinitions' => [
                    ['AttributeName' => 'PK', 'AttributeType' => 'S'],
                    ['AttributeName' => 'SK', 'AttributeType' => 'S'],
                    ['AttributeName' => 'GSI1PK', 'AttributeType' => 'S'],
                    ['AttributeName' => 'GSI1SK', 'AttributeType' => 'S'],
                ],
                'KeySchema' => [
                    ['AttributeName' => 'PK', 'KeyType' => 'HASH'],
                    ['AttributeName' => 'SK', 'KeyType' => 'RANGE'],
                ],
                'GlobalSecondaryIndexes' => [
                    [
                        'IndexName' => 'GSI1',
                        'KeySchema' => [
                            ['AttributeName' => 'GSI1PK', 'KeyType' => 'HASH'],
                            ['AttributeName' => 'GSI1SK', 'KeyType' => 'RANGE'],
                        ],
                        'Projection' => ['ProjectionType' => 'ALL'],
                    ],
                ],
            ]);

            $client->waitUntil('TableExists', ['TableName' => $table]);
            $this->info("Created table {$table}.");
        } catch (DynamoDbException $e) {
            if ($e->getAwsErrorCode() === 'ResourceInUseException') {
                $this->info("Table {$table} already exists.");
            } else {
                throw $e;
            }
        }

        // TTL is a separate call and also idempotent.
        try {
            $ttlAttr = (string) config('dynamodb.ttl_attribute', 'ttl');
            $client->updateTimeToLive([
                'TableName' => $table,
                'TimeToLiveSpecification' => ['Enabled' => true, 'AttributeName' => $ttlAttr],
            ]);
            $this->info("Enabled TTL on '{$ttlAttr}'.");
        } catch (DynamoDbException $e) {
            // Already enabled, or dynamodb-local quirk — non-fatal.
            $this->line('TTL: '.$e->getAwsErrorMessage());
        }

        return self::SUCCESS;
    }
}
