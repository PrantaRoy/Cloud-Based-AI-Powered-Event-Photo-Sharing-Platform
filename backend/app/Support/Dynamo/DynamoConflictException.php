<?php

namespace App\Support\Dynamo;

use RuntimeException;

/**
 * Thrown when a DynamoDB conditional write fails — e.g. a duplicate email lock
 * or slug pointer. Controllers translate this into a 409/422 response.
 */
class DynamoConflictException extends RuntimeException {}
