<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class PhotoSearchRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'selfie' => ['required', 'image', 'max:10240'],
            // Biometric-matching opt-in. Required only on the first search
            // (enforced in the controller once the stored flag is checked).
            'consent' => ['sometimes', 'boolean'],
        ];
    }
}
