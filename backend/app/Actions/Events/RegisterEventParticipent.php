<?php

namespace App\Actions\Events;

use App\Models\Event;
use App\Models\EventParticipent;
use App\Models\User;
use App\Repositories\MemberRepository;
use App\Support\Dynamo\DynamoConflictException;
use Illuminate\Validation\ValidationException;

class RegisterEventParticipent
{
    public function __construct(private MemberRepository $members) {}

    public function handle(Event $event, User $user, bool $emailNotify = false): EventParticipent
    {
        if ($this->members->isMember($event->id, $user->id)) {
            throw ValidationException::withMessages([
                'event' => __('You are already registered for this event.'),
            ]);
        }

        $autoApprove = $event->reg_auto_approve && $event->privacy !== 'protected';

        try {
            return $this->members->create(
                $event->id,
                $user->id,
                $autoApprove ? 'approved' : 'pending',
                $emailNotify,
                $user->name,
                $user->email,
            );
        } catch (DynamoConflictException) {
            throw ValidationException::withMessages([
                'event' => __('You are already registered for this event.'),
            ]);
        }
    }
}
