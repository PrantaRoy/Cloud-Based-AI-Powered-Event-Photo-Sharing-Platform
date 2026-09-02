<?php

namespace App\Rules;

use App\Repositories\UserRepository;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class UniqueEmail implements ValidationRule
{
    public function __construct(private ?int $exceptUserId = null) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            return;
        }

        if (app(UserRepository::class)->emailExists($value, $this->exceptUserId)) {
            $fail('The :attribute has already been taken.');
        }
    }
}
