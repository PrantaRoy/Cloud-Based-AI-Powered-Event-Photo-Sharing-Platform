<?php

namespace App\Policies;

use App\Models\Event;
use App\Models\EventMedia;
use App\Models\User;
use App\Repositories\MemberRepository;

class EventPolicy
{
    public function __construct(private MemberRepository $members) {}

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Event $event): bool
    {
        if ($event->privacy !== 'private') {
            return true;
        }

        return $this->isOrganiser($user, $event) || $this->members->isMember($event->id, $user->id);
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
        return $this->isOrganiser($user, $event) || $this->members->isApprovedParticipant($event->id, $user->id);
    }

    public function deleteMedia(User $user, Event $event, EventMedia $media): bool
    {
        return $this->isOrganiser($user, $event) || $media->uploaded_by === $user->id;
    }

    /**
     * Selfie-based "find my photos" search — organisers, and approved
     * participants (the same people who may upload).
     */
    public function searchPhotos(User $user, Event $event): bool
    {
        return $this->isOrganiser($user, $event)
            || $this->members->isApprovedParticipant($event->id, $user->id);
    }

    protected function isOrganiser(User $user, Event $event): bool
    {
        return $user->role === 'admin' || $user->id === $event->organiser_id;
    }
}
