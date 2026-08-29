<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\DynamoService;
use Illuminate\Support\Str;

class EventController extends Controller
{
    public function __construct(protected DynamoService $dynamo) {}

    /**
     * GET /api/events
     * ?organiser=me  → only events created by the current user
     */
    public function index(Request $request)
    {
        $filters = [];
        if ($request->query('organiser') === 'me') {
            $filters['organiserId'] = $request->auth_user_id;
        }

        $events = $this->dynamo->listEvents($filters);

        // Apply status filter if provided
        if ($status = $request->query('status')) {
            $events = array_values(array_filter(
                $events,
                fn($e) => strtolower($e['status'] ?? '') === strtolower($status)
            ));
        }

        return response()->json($events);
    }

    /**
     * GET /api/events/{id}
     */
    public function show(string $id)
    {
        $event = $this->dynamo->getEvent($id);
        if (!$event) {
            return response()->json(['error' => 'Event not found'], 404);
        }
        return response()->json($event);
    }

    /**
     * POST /api/events
     */
    public function store(Request $request)
    {
        $request->validate([
            'name'    => 'required|string|max:120',
            'date'    => 'required|date',
            'venue'   => 'required|string|max:200',
            'privacy' => 'required|in:Public,Protected,Private',
        ]);

        $eventId = 'evt-' . Str::uuid();

        $event = [
            'eventId'          => $eventId,
            'name'             => $request->name,
            'date'             => $request->date,
            'venue'            => $request->venue,
            'privacy'          => $request->privacy,
            'organiserId'      => $request->auth_user_id,
            'organiserEmail'   => $request->auth_email,
            'status'           => 'Upcoming',
            'participantCount' => 0,
            'photoCount'       => 0,
            'bannerKey'        => null,
            'qrcodeKey'        => null,  // TODO: generate QR code → upload to S3
            'createdAt'        => now()->toIso8601String(),
        ];

        $this->dynamo->putEvent($event);

        return response()->json($event, 201);
    }

    /**
     * PATCH /api/events/{id}
     */
    public function update(Request $request, string $id)
    {
        $event = $this->dynamo->getEvent($id);
        if (!$event) {
            return response()->json(['error' => 'Event not found'], 404);
        }
        if ($event['organiserId'] !== $request->auth_user_id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $updated = array_merge($event, array_filter([
            'name'      => $request->name,
            'date'      => $request->date,
            'venue'     => $request->venue,
            'privacy'   => $request->privacy,
            'status'    => $request->status,
            'updatedAt' => now()->toIso8601String(),
        ], fn($v) => $v !== null));

        $this->dynamo->putEvent($updated);
        return response()->json($updated);
    }
}
