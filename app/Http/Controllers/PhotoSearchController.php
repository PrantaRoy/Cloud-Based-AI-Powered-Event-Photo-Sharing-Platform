<?php

namespace App\Http\Controllers;

use App\Http\Requests\PhotoSearchRequest;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class PhotoSearchController extends Controller
{
    public function search(PhotoSearchRequest $request)
    {
        try {
            $request->validated();

            return $this->apiSuccess('Photo search submitted', [
                'matches' => [],
                'status' => 'coming_soon',
            ]);
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to submit photo search'));
        }
    }
}
