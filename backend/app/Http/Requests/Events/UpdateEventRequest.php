<?php

namespace App\Http\Requests\Events;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEventRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'event_date' => ['sometimes', 'date'],
            'venue' => ['sometimes', 'string', 'max:255'],
            'longitude' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'string', 'max:255'],
            'privacy' => ['sometimes', 'string', Rule::in(['public', 'private', 'protected'])],
            'status' => ['sometimes', 'string', Rule::in(['pending', 'scheduled', 'active', 'finished', 'cancelled', 'archived'])],
            'start_time' => ['nullable', 'date'],
            'end_time' => ['nullable', 'date', 'after_or_equal:start_time'],
            'reg_auto_approve' => ['sometimes', 'boolean'],
        ];
    }
}
