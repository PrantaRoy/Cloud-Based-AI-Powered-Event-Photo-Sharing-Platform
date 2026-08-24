<?php

namespace App\Concerns;

use Illuminate\Http\JsonResponse;
use Throwable;

trait ApiResponseHandler
{
    protected function apiResponse(
        bool $status,
        int $statusCode,
        string $message,
        mixed $data = null,
    ): JsonResponse {
        $response = [
            'status' => $status,
            'statusCode' => $statusCode,
            'message' => $message,
        ];

        if ($data !== null) {
            $response['data'] = $data;
        }

        return response()->json($response, $statusCode);
    }

    protected function apiSuccess(
        string $message,
        mixed $data = null,
        int $statusCode = 200,
    ): JsonResponse {
        return $this->apiResponse(true, $statusCode, $message, $data);
    }

    protected function apiError(
        string $message = 'Server error',
        int $statusCode = 500,
        mixed $data = null,
    ): JsonResponse {
        return $this->apiResponse(false, $statusCode, $message, $data);
    }

    protected function apiExceptionMessage(
        Throwable $e,
        string $fallback = 'Something went wrong. Please try again later.',
    ): string {
        return config('app.debug') ? $e->getMessage() : $fallback;
    }
}
