<?php

namespace Tests\Feature\Api;

use App\Repositories\PasswordResetRepository;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class CoreFlowTest extends TestCase
{
    public function test_register_then_login_then_profile(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Alice',
            'email' => 'alice@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ])->assertCreated()->assertJsonPath('data.user.email', 'alice@example.com');

        $token = $this->postJson('/api/login', ['email' => 'alice@example.com', 'password' => 'Password123!'])
            ->assertOk()->json('data.token');

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/profile')->assertOk()->assertJsonPath('data.name', 'Alice');
    }

    public function test_profile_requires_a_valid_token(): void
    {
        $this->getJson('/api/profile')->assertUnauthorized();
    }

    public function test_profile_rejects_a_bogus_token(): void
    {
        $this->withHeader('Authorization', 'Bearer nonsense')->getJson('/api/profile')->assertUnauthorized();
    }

    public function test_duplicate_email_is_rejected(): void
    {
        $payload = [
            'name' => 'Bob', 'email' => 'bob@example.com',
            'password' => 'Password123!', 'password_confirmation' => 'Password123!',
        ];
        $this->postJson('/api/register', $payload)->assertCreated();
        $this->postJson('/api/register', $payload)->assertStatus(422)->assertJsonStructure(['data' => ['email']]);
    }

    public function test_create_event_then_join_and_upload(): void
    {
        Storage::fake('s3');
        $this->actingAsUser(['role' => 'organiser']);

        $slug = $this->postJson('/api/events', [
            'name' => 'Demo Expo',
            'event_date' => now()->addWeek()->toIso8601String(),
            'venue' => 'Wellington',
            'privacy' => 'public',
        ])->assertCreated()->json('data.slug');

        $this->getJson('/api/events/public')->assertOk()->assertJsonPath('data.0.slug', $slug);

        $this->actingAsUser();
        $this->postJson("/api/events/{$slug}/participants")->assertCreated()->assertJsonPath('data.status', 'approved');
        $this->postJson("/api/events/{$slug}/photos", ['photo' => UploadedFile::fake()->image('snap.jpg')])->assertCreated();
        $this->getJson("/api/events/{$slug}/photos")->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_only_joined_participants_can_view_event_photos(): void
    {
        Storage::fake('s3');
        $this->actingAsUser(['role' => 'organiser']);

        $slug = $this->postJson('/api/events', [
            'name' => 'Members Only Gallery',
            'event_date' => now()->addWeek()->toIso8601String(),
            'venue' => 'Wellington',
            'privacy' => 'public',
        ])->assertCreated()->json('data.slug');

        $this->postJson("/api/events/{$slug}/photos", ['photo' => UploadedFile::fake()->image('snap.jpg')])
            ->assertCreated();

        // A signed-in user who never joined can see the (public) event itself,
        // but must not be able to list or otherwise reach its photo gallery.
        $this->actingAsUser();
        $this->getJson("/api/events/{$slug}")->assertOk();
        $this->getJson("/api/events/{$slug}/photos")->assertForbidden();

        // Joining (auto-approved here) grants access to the same endpoint.
        $this->postJson("/api/events/{$slug}/participants")->assertCreated()->assertJsonPath('data.status', 'approved');
        $this->getJson("/api/events/{$slug}/photos")->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_password_reset_happy_path(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Carol', 'email' => 'carol@example.com',
            'password' => 'Password123!', 'password_confirmation' => 'Password123!',
        ])->assertCreated();

        $token = Str::random(64);
        app(PasswordResetRepository::class)->put('carol@example.com', hash('sha256', $token));

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => 'carol@example.com',
            'password' => 'NewPassword456!',
            'password_confirmation' => 'NewPassword456!',
        ])->assertOk();

        $this->postJson('/api/login', ['email' => 'carol@example.com', 'password' => 'NewPassword456!'])->assertOk();
    }
}
