<?php

namespace App\Support\Dynamo;

use Aws\DynamoDb\DynamoDbClient;
use Aws\DynamoDb\Exception\DynamoDbException;
use Aws\DynamoDb\Marshaler;

/**
 * Thin wrapper over the AWS SDK DynamoDB client for the single-table design.
 *
 * All public methods speak plain PHP arrays; marshalling to/from the DynamoDB
 * attribute-value format is handled here via the SDK Marshaler.
 *
 * @phpstan-type DynamoItem array<string, mixed>
 * @phpstan-type DynamoKey array{PK: string, SK: string}
 */
class DynamoClient
{
    protected DynamoDbClient $client;

    protected Marshaler $marshaler;

    protected string $table;

    /**
     * @param  array<string, mixed>  $config  the `config('dynamodb')` array
     */
    public function __construct(array $config)
    {
        $this->table = (string) $config['table'];

        $sdkConfig = [
            'region' => (string) $config['region'],
            'version' => '2012-08-10',
        ];

        if (! empty($config['endpoint'])) {
            $sdkConfig['endpoint'] = (string) $config['endpoint'];
            $sdkConfig['credentials'] = [
                'key' => $config['credentials']['key'] ?: 'local',
                'secret' => $config['credentials']['secret'] ?: 'local',
            ];
        } elseif (! empty($config['credentials']['key']) && ! empty($config['credentials']['secret'])) {
            $sdkConfig['credentials'] = [
                'key' => (string) $config['credentials']['key'],
                'secret' => (string) $config['credentials']['secret'],
            ];
        }
        // Otherwise: no credentials key => SDK falls back to the default
        // provider chain (env vars, then the EC2 instance profile in prod).

        $this->client = new DynamoDbClient($sdkConfig);
        $this->marshaler = new Marshaler(['nullify_invalid' => true]);
    }

    public function tableName(): string
    {
        return $this->table;
    }

    public function raw(): DynamoDbClient
    {
        return $this->client;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getItem(string $pk, string $sk, bool $consistent = false): ?array
    {
        $result = $this->client->getItem([
            'TableName' => $this->table,
            'Key' => $this->marshaler->marshalItem(['PK' => $pk, 'SK' => $sk]),
            'ConsistentRead' => $consistent,
        ]);

        $item = $result['Item'] ?? null;

        return $item === null ? null : $this->unmarshal($item);
    }

    /**
     * @param  array<string, mixed>  $item  a marshalled DynamoDB item
     * @return array<string, mixed>
     */
    protected function unmarshal(array $item): array
    {
        $result = $this->marshaler->unmarshalItem($item);

        return is_array($result) ? $result : (array) $result;
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  array<string, string>  $names
     * @param  array<string, mixed>  $values
     *
     * @throws DynamoConflictException when a condition expression fails
     */
    public function putItem(array $item, ?string $conditionExpression = null, array $names = [], array $values = []): void
    {
        $params = [
            'TableName' => $this->table,
            'Item' => $this->marshaler->marshalItem($item),
        ];

        if ($conditionExpression !== null) {
            $params['ConditionExpression'] = $conditionExpression;
            if ($names !== []) {
                $params['ExpressionAttributeNames'] = $names;
            }
            if ($values !== []) {
                $params['ExpressionAttributeValues'] = $this->marshaler->marshalItem($values);
            }
        }

        try {
            $this->client->putItem($params);
        } catch (DynamoDbException $e) {
            if ($e->getAwsErrorCode() === 'ConditionalCheckFailedException') {
                throw new DynamoConflictException('DynamoDB conditional check failed', 0, $e);
            }
            throw $e;
        }
    }

    /**
     * Apply a SET / REMOVE update to one item and return the new item.
     *
     * @param  array<string, mixed>  $set  attributes to SET
     * @param  list<string>  $remove  attribute names to REMOVE
     * @return array<string, mixed>
     */
    public function updateItem(string $pk, string $sk, array $set = [], array $remove = []): array
    {
        $names = [];
        $values = [];
        $setParts = [];
        $removeParts = [];

        $i = 0;
        foreach ($set as $attr => $value) {
            $nameKey = '#s'.$i;
            $valueKey = ':s'.$i;
            $names[$nameKey] = $attr;
            $values[$valueKey] = $value;
            $setParts[] = "$nameKey = $valueKey";
            $i++;
        }

        $j = 0;
        foreach ($remove as $attr) {
            $nameKey = '#r'.$j;
            $names[$nameKey] = $attr;
            $removeParts[] = $nameKey;
            $j++;
        }

        $expression = trim(
            ($setParts !== [] ? 'SET '.implode(', ', $setParts).' ' : '').
            ($removeParts !== [] ? 'REMOVE '.implode(', ', $removeParts) : '')
        );

        $params = [
            'TableName' => $this->table,
            'Key' => $this->marshaler->marshalItem(['PK' => $pk, 'SK' => $sk]),
            'UpdateExpression' => $expression,
            'ExpressionAttributeNames' => $names,
            'ReturnValues' => 'ALL_NEW',
        ];

        if ($values !== []) {
            $params['ExpressionAttributeValues'] = $this->marshaler->marshalItem($values);
        }

        $result = $this->client->updateItem($params);

        return $this->unmarshal($result['Attributes'] ?? []);
    }

    /**
     * Atomically add to a numeric attribute and return its new value.
     */
    public function incrementCounter(string $pk, string $sk, string $attribute = 'seq', int $by = 1): int
    {
        $result = $this->client->updateItem([
            'TableName' => $this->table,
            'Key' => $this->marshaler->marshalItem(['PK' => $pk, 'SK' => $sk]),
            'UpdateExpression' => 'ADD #a :n',
            'ExpressionAttributeNames' => ['#a' => $attribute],
            'ExpressionAttributeValues' => $this->marshaler->marshalItem([':n' => $by]),
            'ReturnValues' => 'UPDATED_NEW',
        ]);

        return (int) ($this->unmarshal($result['Attributes'] ?? [])[$attribute] ?? 0);
    }

    public function deleteItem(string $pk, string $sk): void
    {
        $this->client->deleteItem([
            'TableName' => $this->table,
            'Key' => $this->marshaler->marshalItem(['PK' => $pk, 'SK' => $sk]),
        ]);
    }

    /**
     * Run a Query, following pagination, and return unmarshalled items.
     *
     * @param  array<string, mixed>  $params  merged into the Query call (without TableName)
     * @return list<array<string, mixed>>
     */
    public function query(array $params): array
    {
        $params['TableName'] = $this->table;
        if (isset($params['ExpressionAttributeValues'])) {
            $params['ExpressionAttributeValues'] = $this->marshaler->marshalItem($params['ExpressionAttributeValues']);
        }

        $items = [];
        do {
            $result = $this->client->query($params);
            foreach ($result['Items'] ?? [] as $item) {
                $items[] = $this->unmarshal($item);
            }
            $params['ExclusiveStartKey'] = $result['LastEvaluatedKey'] ?? null;
        } while (! empty($params['ExclusiveStartKey']));

        return $items;
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>|null
     */
    public function queryFirst(array $params): ?array
    {
        $params['Limit'] = 1;
        $items = $this->query($params);

        return $items[0] ?? null;
    }

    /**
     * @param  array<string, mixed>  $params
     */
    public function count(array $params): int
    {
        $params['TableName'] = $this->table;
        $params['Select'] = 'COUNT';
        if (isset($params['ExpressionAttributeValues'])) {
            $params['ExpressionAttributeValues'] = $this->marshaler->marshalItem($params['ExpressionAttributeValues']);
        }

        $total = 0;
        do {
            $result = $this->client->query($params);
            $total += (int) ($result['Count'] ?? 0);
            $params['ExclusiveStartKey'] = $result['LastEvaluatedKey'] ?? null;
        } while (! empty($params['ExclusiveStartKey']));

        return $total;
    }

    /**
     * Scan the whole table. Use sparingly — only stats/admin/test paths.
     *
     * @param  array<string, mixed>  $params
     * @return list<array<string, mixed>>
     */
    public function scan(array $params = []): array
    {
        $params['TableName'] = $this->table;
        if (isset($params['ExpressionAttributeValues'])) {
            $params['ExpressionAttributeValues'] = $this->marshaler->marshalItem($params['ExpressionAttributeValues']);
        }

        $items = [];
        do {
            $result = $this->client->scan($params);
            foreach ($result['Items'] ?? [] as $item) {
                $items[] = $this->unmarshal($item);
            }
            $params['ExclusiveStartKey'] = $result['LastEvaluatedKey'] ?? null;
        } while (! empty($params['ExclusiveStartKey']));

        return $items;
    }

    /**
     * @param  array<string, mixed>  $params
     */
    public function scanCount(array $params = []): int
    {
        $params['TableName'] = $this->table;
        $params['Select'] = 'COUNT';
        if (isset($params['ExpressionAttributeValues'])) {
            $params['ExpressionAttributeValues'] = $this->marshaler->marshalItem($params['ExpressionAttributeValues']);
        }

        $total = 0;
        do {
            $result = $this->client->scan($params);
            $total += (int) ($result['Count'] ?? 0);
            $params['ExclusiveStartKey'] = $result['LastEvaluatedKey'] ?? null;
        } while (! empty($params['ExclusiveStartKey']));

        return $total;
    }

    /**
     * @param  list<array{PK: string, SK: string}>  $keys
     * @return list<array<string, mixed>>
     */
    public function batchGet(array $keys): array
    {
        $items = [];
        foreach (array_chunk($keys, 100) as $chunk) {
            $request = array_map(
                fn (array $key) => $this->marshaler->marshalItem(['PK' => $key['PK'], 'SK' => $key['SK']]),
                $chunk
            );

            $keysAndAttributes = ['Keys' => $request];
            do {
                $result = $this->client->batchGetItem([
                    'RequestItems' => [$this->table => $keysAndAttributes],
                ]);
                foreach ($result['Responses'][$this->table] ?? [] as $item) {
                    $items[] = $this->unmarshal($item);
                }
                $unprocessed = $result['UnprocessedKeys'][$this->table] ?? null;
                $keysAndAttributes = $unprocessed ?: null;
            } while ($keysAndAttributes !== null);
        }

        return $items;
    }

    /**
     * @param  list<array{PK: string, SK: string}>  $keys
     */
    public function batchDelete(array $keys): void
    {
        foreach (array_chunk($keys, 25) as $chunk) {
            $requests = array_map(fn (array $key) => [
                'DeleteRequest' => [
                    'Key' => $this->marshaler->marshalItem(['PK' => $key['PK'], 'SK' => $key['SK']]),
                ],
            ], $chunk);

            do {
                $result = $this->client->batchWriteItem([
                    'RequestItems' => [$this->table => $requests],
                ]);
                $requests = $result['UnprocessedItems'][$this->table] ?? [];
            } while ($requests !== []);
        }
    }

    /**
     * @param  list<array<string, mixed>>  $items  raw TransactWriteItems entries,
     *                                             each already keyed by Put/Update/Delete/ConditionCheck
     *
     * @throws DynamoConflictException when any condition fails
     */
    public function transactWrite(array $items): void
    {
        foreach ($items as &$item) {
            foreach ($item as $op => &$spec) {
                $spec['TableName'] ??= $this->table;
                if (isset($spec['Item'])) {
                    $spec['Item'] = $this->marshaler->marshalItem($spec['Item']);
                }
                if (isset($spec['Key'])) {
                    $spec['Key'] = $this->marshaler->marshalItem($spec['Key']);
                }
                if (isset($spec['ExpressionAttributeValues'])) {
                    $spec['ExpressionAttributeValues'] = $this->marshaler->marshalItem($spec['ExpressionAttributeValues']);
                }
                unset($spec);
            }
            unset($item);
        }

        try {
            $this->client->transactWriteItems(['TransactItems' => $items]);
        } catch (DynamoDbException $e) {
            if ($e->getAwsErrorCode() === 'TransactionCanceledException') {
                throw new DynamoConflictException('DynamoDB transaction cancelled: '.$e->getAwsErrorMessage(), 0, $e);
            }
            throw $e;
        }
    }
}
