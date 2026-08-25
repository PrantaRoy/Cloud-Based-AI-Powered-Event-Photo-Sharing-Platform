<?php

namespace App\Actions\Events;

use App\Models\Event;
use App\Models\EventParticipent;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RegisterEventParticipent
{
    public function handle(Event $event, User $user, bool $emailNotify = false): EventParticipent
    {
        return DB::transaction(function () use ($event, $user, $emailNotify) {
            if ($event->participants()->where('user_id', $user->id)->exists()) {
                throw ValidationException::withMessages([
                    'event' => __('You are already registered for this event.'),
                ]);
            }

            $autoApprove = $event->reg_auto_approve && $event->privacy !== 'protected';

            return $event->participants()->create([
                'user_id' => $user->id,
                'status' => $autoApprove ? 'approved' : 'pending',
                'registered_at' => now(),
                'approved_at' => $autoApprove ? now() : null,
                'email_notify' => $emailNotify,
            ]);
        });
    }
}
