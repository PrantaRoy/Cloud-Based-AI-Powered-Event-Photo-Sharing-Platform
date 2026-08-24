<?php

namespace App\Policies;

use App\Models\Event;
use App\Models\User;

class EventPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Event $event): bool
    {
        if ($event->privacy !== 'private') {
            return true;
        }

        return $this->isOrganiser($user, $event)
            || $event->participants()->where('user_id', $user->id)->exists();
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Event $event): bool
    {
        return $this->isOrganiser($user, $event);
    }

    public function delete(User $user, Event $event): bool
    {
        return $this->isOrganiser($user, $event);
    }

    public function viewParticipants(User $user, Event $event): bool
    {
        return $this->isOrganiser($user, $event);
    }

    public function register(User $user, Event $event): bool
    {
        return $this->view($user, $event);
    }

    public function manageParticipant(User $user, Event $event): bool
    {
        return $this->isOrganiser($user, $event);
    }

    public function uploadMedia(User $user, Event $event): bool
    {
        if ($this->isOrganiser($user, $event)) {
            return true;
        }

        return $event->participants()
            ->where('user_id', $user->id)
            ->where('status', 'approved')
            ->exists();
    }

    protected function isOrganiser(User $user, Event $event): bool
    {
        return $user->role === 'admin' || $user->id === $event->organiser_id;
    }
}
