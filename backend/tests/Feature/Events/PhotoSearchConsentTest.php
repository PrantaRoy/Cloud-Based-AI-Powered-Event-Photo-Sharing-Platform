<?php

namespace Tests\Feature\Events;

use App\Models\Event;
use App\Models\User;
use App\Repositories\EventRepository;
use App\Repositories\MemberRepository;
use App\Repositories\PhotoRepository;
use App\Services\Face\FaceSearchClient;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

/**
 * The biometric-matching consent gate on POST /events/{event}/photo-search.
 *
 * The search Lambda is faked — these tests are about the consent hard-block
 * and the membership flag, not face detection.
 */
class PhotoSearchConsentTest extends TestCase
{
    private function fakeSearchReturns(array $matches): void
    {
        $mock = Mockery::mock(FaceSearchClient::class);
        $mock->shouldReceive('search')->andReturn(['matches' => $matches, 'status' => 'ok'])->byDefault();
        $this->app->instance(FaceSearchClient::class, $mock);
    }

    private function makePublicEvent(): Event
    {
        $organiser = $this->actingAsUser(['role' => 'organiser']);

        return app(EventRepository::class)->create([
            'name' => 'Consent Test Expo',
            'event_date' => now()->addWeek()->toIso8601String(),
            'venue' => 'Hamilton',
            'privacy' => 'public',
            'status' => 'active',
        ], $organiser->id, $organiser->name, $organiser->email);
    }

    /** Join a fresh public event as an approved participant; returns that user. */
    private function joinAsApprovedParticipant(Event $event): User
    {
        $user = $this->actingAsUser();
        $this->postJson("/api/events/{$event->slug}/participants")
            ->assertCreated()
            ->assertJsonPath('data.status', 'approved');

        return $user;
    }

    public function test_search_without_consent_is_blocked_and_records_nothing(): void
    {
        Storage::fake('s3');
        $this->fakeSearchReturns([]);

        $event = $this->makePublicEvent();
        $user = $this->joinAsApprovedParticipant($event);

        $this->postJson("/api/events/{$event->slug}/photo-search", [
            'selfie' => UploadedFile::fake()->image('selfie.jpg'),
        ])->assertStatus(403);

        $member = app(MemberRepository::class)->find($event->id, $user->id);
        $this->assertNull($member->consent_facial_matching);
        $this->assertSame([], Storage::disk('s3')->allFiles('tmp'));
    }

    public function test_non_participant_cannot_search(): void
    {
        Storage::fake('s3');
        $this->fakeSearchReturns([]);

        $event = $this->makePublicEvent();
        $this->actingAsUser(); // a user who never joined

        $this->postJson("/api/events/{$event->slug}/photo-search", [
            'selfie' => UploadedFile::fake()->image('selfie.jpg'),
            'consent' => true,
        ])->assertStatus(403);
    }

    public function test_search_with_consent_records_the_flag_and_returns_matches(): void
    {
        Storage::fake('s3');
        $event = $this->makePublicEvent();
        $user = $this->joinAsApprovedParticipant($event);

        $this->postJson("/api/events/{$event->slug}/photos", [
            'photo' => UploadedFile::fake()->image('group.jpg'),
        ])->assertCreated();
        $photoId = app(PhotoRepository::class)->listForEvent($event->id)[0]->id;

        $this->fakeSearchReturns([['photo_id' => $photoId, 'distance' => 0.42]]);

        $this->postJson("/api/events/{$event->slug}/photo-search", [
            'selfie' => UploadedFile::fake()->image('selfie.jpg'),
            'consent' => true,
        ])->assertOk()
            ->assertJsonPath('data.status', 'ok')
            ->assertJsonCount(1, 'data.matches');

        $member = app(MemberRepository::class)->find($event->id, $user->id);
        $this->assertTrue($member->consent_facial_matching);
        $this->assertNotNull($member->consent_facial_matching_at);

        // Second search needs no consent field now.
        $this->postJson("/api/events/{$event->slug}/photo-search", [
            'selfie' => UploadedFile::fake()->image('selfie2.jpg'),
        ])->assertOk();

        // And the matches are a cheap read.
        $this->getJson("/api/events/{$event->slug}/photo-search/mine")
            ->assertOk()
            ->assertJsonCount(1, 'data.matches');
    }

    public function test_withdrawing_consent_clears_the_flag_and_the_matches(): void
    {
        Storage::fake('s3');
        $event = $this->makePublicEvent();
        $user = $this->joinAsApprovedParticipant($event);

        $this->postJson("/api/events/{$event->slug}/photos", [
            'photo' => UploadedFile::fake()->image('g.jpg'),
        ])->assertCreated();
        $photoId = app(PhotoRepository::class)->listForEvent($event->id)[0]->id;
        $this->fakeSearchReturns([['photo_id' => $photoId, 'distance' => 0.4]]);

        $this->postJson("/api/events/{$event->slug}/photo-search", [
            'selfie' => UploadedFile::fake()->image('selfie.jpg'),
            'consent' => true,
        ])->assertOk();

        $this->deleteJson("/api/events/{$event->slug}/photo-search/consent")->assertOk();

        $member = app(MemberRepository::class)->find($event->id, $user->id);
        $this->assertFalse($member->consent_facial_matching);
        $this->assertNull($member->consent_facial_matching_at);

        $this->getJson("/api/events/{$event->slug}/photo-search/mine")
            ->assertOk()
            ->assertJsonCount(0, 'data.matches');

        // Next search is blocked again until consent is re-granted.
        $this->postJson("/api/events/{$event->slug}/photo-search", [
            'selfie' => UploadedFile::fake()->image('selfie.jpg'),
        ])->assertStatus(403);
    }
}
