<?php

namespace App\Rules;

use App\Repositories\PhotoRepository;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class MediaExists implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (app(PhotoRepository::class)->find((int) $value) === null) {
            $fail('The selected :attribute is invalid.');
        }
    }
}
