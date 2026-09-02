<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\CheckEmailRequest;
use App\Repositories\UserRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class EmailCheckController extends Controller
{
    public function check(CheckEmailRequest $request, UserRepository $users): JsonResponse
    {
        try {
            $exists = $users->findByEmail($request->validated('email')) !== null;

            return $this->apiSuccess('Email checked successfully', ['exists' => $exists]);
        } catch (ValidationException $e) {
            return $this->apiError($e->getMessage(), 422, $e->errors());
        } catch (HttpExceptionInterface $e) {
            return $this->apiError($e->getMessage() ?: 'Request failed', $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);

            return $this->apiError($this->apiExceptionMessage($e, 'Unable to check email'));
        }
    }
}
