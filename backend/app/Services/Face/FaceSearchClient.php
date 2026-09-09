<?php

namespace App\Services\Face;

use App\Models\Event;
use App\Models\User;
use Aws\Lambda\LambdaClient;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * "Search by selfie" — encode the selfie, match it against the event's
 * FACE# rows, return the photos the user appears in by Euclidean distance.
 *
 * Three modes, in priority order:
 *   1. FACE_LOCAL_URL set     -> POST to the local HTTP face-worker (Docker)
 *   2. FACE_SEARCH_LAMBDA_NAME -> synchronous Lambda invoke
 *   3. neither                 -> empty 'unavailable' result (consent is
 *                                 still enforced upstream)
 *
 * The matcher is read-only on DynamoDB; Laravel persists the returned
 * matches. The selfie is never stored as an embedding.
 */
class FaceSearchClient
{
    public function __construct(private LambdaClient $lambda) {}

    public function enabled(): bool
    {
        return ! empty(config('services.face.local_url'))
            || ! empty(config('services.face.search_lambda'));
    }

    /**
     * @return array{matches: list<array{photo_id: int, distance: float}>, status: string}
     */
    public function search(Event $event, User $user, string $selfieKey): array
    {
        if (! empty(config('services.face.local_url'))) {
            return $this->searchLocal($event, $selfieKey);
        }

        if (empty(config('services.face.search_lambda'))) {
            return ['matches' => [], 'status' => 'unavailable'];
        }

        return $this->searchLambda($event, $user, $selfieKey);
    }

    /**
     * @return array{matches: list<array{photo_id: int, distance: float}>, status: string}
     */
    private function searchLocal(Event $event, string $selfieKey): array
    {
        $url = rtrim((string) config('services.face.local_url'), '/').'/search';
        $selfieRef = rtrim((string) config('services.face.image_base_url'), '/').'/'.ltrim($selfieKey, '/');

        try {
            $response = Http::timeout(120)->post($url, [
                'event_id' => $event->id,
                'selfie_ref' => $selfieRef,
                'threshold' => (float) config('services.face.match_threshold'),
            ]);
        } catch (Throwable $e) {
            throw new FaceSearchException('The local face worker is unreachable.', 0, $e);
        }

        if ($response->failed()) {
            throw new FaceSearchException('The local face worker returned an error.');
        }

        $json = $response->json();

        return $this->normalize(is_array($json) ? $json : []);
    }

    /**
     * @return array{matches: list<array{photo_id: int, distance: float}>, status: string}
     */
    private function searchLambda(Event $event, User $user, string $selfieKey): array
    {
        try {
            $result = $this->lambda->invoke([
                'FunctionName' => (string) config('services.face.search_lambda'),
                'InvocationType' => 'RequestResponse',
                'Payload' => json_encode([
                    'eventId' => (string) $event->id,
                    'userId' => (string) $user->id,
                    'bucket' => (string) config('filesystems.disks.s3.bucket'),
                    'selfieKey' => $selfieKey,
                    'threshold' => (float) config('services.face.match_threshold'),
                ], JSON_THROW_ON_ERROR),
            ]);
        } catch (Throwable $e) {
            throw new FaceSearchException('Face search is temporarily unavailable.', 0, $e);
        }

        if (($result['FunctionError'] ?? null) !== null) {
            throw new FaceSearchException('The face search failed to run.');
        }

        /** @var array<string, mixed> $payload */
        $payload = json_decode((string) $result['Payload']->getContents(), true) ?: [];

        return $this->normalize($payload);
    }

    /**
     * Both transports return the same shape:
     *   {"matches": [{"photoId": "7", "distance": 0.41}, ...]}
     * or {"error": "no_face_detected_in_selfie", ...}
     *
     * @param  array<string, mixed>  $payload
     * @return array{matches: list<array{photo_id: int, distance: float}>, status: string}
     */
    private function normalize(array $payload): array
    {
        if (isset($payload['error'])) {
            // A user-actionable outcome, not an infra failure.
            return ['matches' => [], 'status' => (string) $payload['error']];
        }

        $matches = [];
        foreach ($payload['matches'] ?? [] as $match) {
            if (! isset($match['photoId'])) {
                continue;
            }
            $matches[] = [
                'photo_id' => (int) $match['photoId'],
                'distance' => (float) ($match['distance'] ?? 0),
            ];
        }

        return ['matches' => $matches, 'status' => 'ok'];
    }
}
