<?php

namespace Tests\Feature\Events;

use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EventShareTest extends TestCase
{
    use RefreshDatabase;

    public function test_creating_an_event_generates_a_readable_unique_slug(): void
    {
        $event = Event::factory()->create(['name' => 'Summer Gala 2026']);

        $this->assertNotEmpty($event->slug);
        $this->assertStringStartsWith('summer-gala-2026-', $event->slug);
        $this->assertMatchesRegularExpression('/^summer-gala-2026-[a-z0-9]{6}$/', $event->slug);
    }

    public function test_events_with_the_same_name_get_distinct_slugs(): void
    {
        $a = Event::factory()->create(['name' => 'Same Name']);
        $b = Event::factory()->create(['name' => 'Same Name']);

        $this->assertNotSame($a->slug, $b->slug);
    }

    public function test_a_name_that_slugifies_to_empty_falls_back_to_event(): void
    {
        $event = Event::factory()->create(['name' => '🎉🎉']);

        $this->assertStringStartsWith('event-', $event->slug);
    }

    public function test_updating_the_name_does_not_change_the_slug(): void
    {
        $event = Event::factory()->create(['name' => 'Original Name']);
        $original = $event->slug;

        $event->update(['name' => 'Renamed Event']);

        $this->assertSame($original, $event->fresh()->slug);
    }

    public function test_event_can_be_resolved_by_slug_or_id(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $event = Event::factory()->create(['privacy' => 'public']);

        $this->getJson("/api/events/{$event->slug}")->assertOk()->assertJsonPath('data.id', $event->id);
        $this->getJson("/api/events/{$event->id}")->assertOk()->assertJsonPath('data.slug', $event->slug);
        $this->getJson('/api/events/does-not-exist')->assertNotFound();
    }

    public function test_event_resource_exposes_share_fields(): void
    {
        config(['app.frontend_url' => 'https://app.test']);
        Sanctum::actingAs(User::factory()->create());
        $event = Event::factory()->create(['privacy' => 'public']);

        $this->getJson("/api/events/{$event->slug}")
            ->assertOk()
            ->assertJsonPath('data.slug', $event->slug)
            ->assertJsonPath('data.public_url', "https://app.test/e/{$event->slug}")
            ->assertJsonPath('data.qr_code_url', route('events.qr', $event->slug));
    }

    public function test_qr_endpoint_returns_an_svg_without_authentication(): void
    {
        $event = Event::factory()->create();

        $response = $this->get("/api/events/{$event->slug}/qr");

        $response->assertOk();
        $this->assertSame('image/svg+xml', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('<svg', $response->getContent());
        $this->assertFalse($response->headers->has('Content-Disposition'));

        $this->get("/api/events/{$event->slug}/qr?download=1")
            ->assertOk()
            ->assertHeader('Content-Disposition', 'attachment; filename="'.$event->slug.'-qr.svg"');
    }

    public function test_public_endpoint_returns_public_events_without_authentication(): void
    {
        $event = Event::factory()->create(['privacy' => 'public']);

        $this->getJson("/api/events/public/{$event->slug}")
            ->assertOk()
            ->assertJsonPath('data.id', $event->id);
    }

    public function test_public_endpoint_hides_private_events_but_returns_the_name(): void
    {
        $event = Event::factory()->create(['privacy' => 'private']);

        $this->getJson("/api/events/public/{$event->slug}")
            ->assertForbidden()
            ->assertJsonPath('data.name', $event->name);
    }
}
