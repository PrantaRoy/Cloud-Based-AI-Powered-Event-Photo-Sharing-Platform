<?php

namespace Tests\Feature\Events;

use App\Models\Event;
use App\Repositories\EventRepository;
use Tests\TestCase;

class EventShareTest extends TestCase
{
    private function makeEvent(array $overrides = []): Event
    {
        $organiser = $this->actingAsUser(['role' => 'organiser']);

        return app(EventRepository::class)->create(array_merge([
            'name' => 'Summer Gala 2026',
            'event_date' => '2026-08-01T18:00:00+00:00',
            'venue' => 'Auckland',
            'privacy' => 'public',
            'status' => 'active',
        ], $overrides), $organiser->id, $organiser->name, $organiser->email);
    }

    public function test_creating_an_event_generates_a_readable_unique_slug(): void
    {
        $event = $this->makeEvent(['name' => 'Summer Gala 2026']);

        $this->assertMatchesRegularExpression('/^summer-gala-2026-[a-z0-9]{6}$/', $event->slug);
    }

    public function test_events_with_the_same_name_get_distinct_slugs(): void
    {
        $a = $this->makeEvent(['name' => 'Same Name']);
        $b = $this->makeEvent(['name' => 'Same Name']);

        $this->assertNotSame($a->slug, $b->slug);
    }

    public function test_a_name_that_slugifies_to_empty_falls_back_to_event(): void
    {
        $event = $this->makeEvent(['name' => '🎉🎉']);

        $this->assertStringStartsWith('event-', $event->slug);
    }

    public function test_event_can_be_resolved_by_slug_or_id(): void
    {
        $event = $this->makeEvent(['privacy' => 'public']);

        $this->getJson("/api/events/{$event->slug}")->assertOk()->assertJsonPath('data.id', $event->id);
        $this->getJson("/api/events/{$event->id}")->assertOk()->assertJsonPath('data.slug', $event->slug);
        $this->getJson('/api/events/does-not-exist')->assertNotFound();
    }

    public function test_event_resource_exposes_share_fields(): void
    {
        config(['app.frontend_url' => 'https://app.test']);
        $event = $this->makeEvent(['privacy' => 'public']);

        $this->getJson("/api/events/{$event->slug}")
            ->assertOk()
            ->assertJsonPath('data.public_url', "https://app.test/e/{$event->slug}")
            ->assertJsonPath('data.qr_code_url', route('events.qr', $event->slug));
    }

    public function test_qr_endpoint_returns_an_svg_without_authentication(): void
    {
        $event = $this->makeEvent();

        $response = $this->get("/api/events/{$event->slug}/qr");
        $response->assertOk();
        $this->assertSame('image/svg+xml', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('<svg', $response->getContent());

        $this->get("/api/events/{$event->slug}/qr?download=1")
            ->assertHeader('Content-Disposition', 'attachment; filename="'.$event->slug.'-qr.svg"');
    }

    public function test_public_endpoint_hides_private_events_but_returns_the_name(): void
    {
        $event = $this->makeEvent(['privacy' => 'private', 'name' => 'Secret Party']);

        $this->getJson("/api/events/public/{$event->slug}")
            ->assertForbidden()
            ->assertJsonPath('data.name', 'Secret Party');
    }
}
