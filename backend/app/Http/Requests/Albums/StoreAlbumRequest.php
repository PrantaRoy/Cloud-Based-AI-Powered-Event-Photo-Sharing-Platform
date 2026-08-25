<?php

namespace App\Http\Requests\Albums;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreAlbumRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'event_media_ids' => ['sometimes', 'array'],
            'event_media_ids.*' => ['integer', 'exists:event_media,id'],
        ];
    }
}
