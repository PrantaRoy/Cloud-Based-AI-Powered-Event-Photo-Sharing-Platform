<?php

namespace App\Repositories;

use App\Support\Dynamo\DynamoClient;
use Carbon\CarbonImmutable;

abstract class BaseRepository
{
    public function __construct(protected DynamoClient $dynamo) {}

    protected function now(): string
    {
        return CarbonImmutable::now('UTC')->toIso8601String();
    }

    // --- key builders (single-table design) ----------------------------

    protected function userPk(int $id): string
    {
        return 'USER#'.$id;
    }

    protected function eventPk(int $id): string
    {
        return 'EVENT#'.$id;
    }

    protected function albumPk(int $id): string
    {
        return 'ALBUM#'.$id;
    }

    protected function emailKey(string $email): string
    {
        return 'EMAIL#'.mb_strtolower(trim($email));
    }

    protected function slugKey(string $slug): string
    {
        return 'SLUG#'.$slug;
    }

    protected function counterPk(string $entity): string
    {
        return 'COUNTER#'.$entity;
    }

    /**
     * Next surrogate id for an entity (atomic counter item).
     */
    protected function nextId(string $entity): int
    {
        return $this->dynamo->incrementCounter($this->counterPk($entity), 'COUNTER');
    }
}
