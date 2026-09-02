<?php

namespace App\Http\Controllers;

use App\Http\Requests\PhotoSearchRequest;
use Illuminate\Http\JsonResponse;
use Throwable;

class PhotoSearchController extends Controller
{
    /**
     * Selfie-based photo search. The AI pipeline (Lambda + face recognition)
     * is designed but not deployed for this demo — see the architecture doc.
     */
    public function search(PhotoSearchRequest $request): JsonResponse
    {
        try {
            $request->validated();

            return $this->apiSuccess('Photo search submitted', [
                'matches' => [],
                'status' => 'coming_soon',
            ]);
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to submit photo search'));
        }
    }
}
