<?php

namespace App\Http\Requests\Albums;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class AttachAlbumMediaRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'event_media_ids' => ['required', 'array', 'min:1'],
            'event_media_ids.*' => ['integer', 'exists:event_media,id'],
        ];
    }
}
