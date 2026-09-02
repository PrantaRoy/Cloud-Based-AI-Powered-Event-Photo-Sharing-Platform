<?php

namespace App\Actions\Auth;

use App\Concerns\PasswordValidationRules;
use App\Models\User;
use App\Repositories\UserRepository;
use App\Rules\UniqueEmail;
use App\Support\Dynamo\DynamoConflictException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class RegisterUser
{
    use PasswordValidationRules;

    public function __construct(private UserRepository $users) {}

    /**
     * @param  array<string, mixed>  $input
     */
    public function create(array $input): User
    {
        $data = Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', new UniqueEmail],
            'password' => $this->passwordRules(),
        ])->validate();

        try {
            return $this->users->create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
            ]);
        } catch (DynamoConflictException) {
            // Authoritative uniqueness check — the conditional write on the
            // email lock lost a race the GSI read in UniqueEmail didn't see.
            throw ValidationException::withMessages([
                'email' => ['The email has already been taken.'],
            ]);
        }
    }
}
