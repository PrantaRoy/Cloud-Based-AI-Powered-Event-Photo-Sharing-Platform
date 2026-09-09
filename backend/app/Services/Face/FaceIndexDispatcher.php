<?php

namespace App\Services\Face;

use App\Models\Event;
use App\Models\EventMedia;
use Aws\Sqs\SqsClient;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * After a photo is written to storage, hand it off for face indexing —
 * detect + encode every face, write FACE# rows, flip processing_status.
 *
 * Three modes, in priority order:
 *   1. FACE_LOCAL_URL set    -> POST to the local HTTP face-worker (Docker)
 *   2. FACE_INDEX_QUEUE_URL   -> drop a message on SQS for the index Lambda
 *   3. neither                -> no-op; the photo stays 'completed'
 */
class FaceIndexDispatcher
{
    public function __construct(private SqsClient $sqs) {}

    public function enabled(): bool
    {
        return ! empty(config('services.face.local_url'))
            || ! empty(config('services.face.index_queue_url'));
    }

    public function enqueue(Event $event, EventMedia $media): void
    {
        if (! empty(config('services.face.local_url'))) {
            $this->dispatchLocal($event, $media);

            return;
        }

        if (empty(config('services.face.index_queue_url'))) {
            return;
        }

        $payload = [
            'event_id' => $event->id,
            'photo_id' => $media->id,
            'photo_sk' => $this->photoSk($media),
            'bucket' => (string) config('filesystems.disks.s3.bucket'),
            'key' => $media->original_s3_path,
        ];

        try {
            $this->sqs->sendMessage([
                'QueueUrl' => (string) config('services.face.index_queue_url'),
                'MessageBody' => json_encode($payload, JSON_THROW_ON_ERROR),
            ]);
        } catch (Throwable $e) {
            report($e);
            Log::warning('Face index enqueue failed', ['photo_id' => $media->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Local worker: fire the index call after the response is sent so the
     * upload stays snappy (QUEUE_CONNECTION=sync in dev, so this still runs
     * in-process — just after terminate()).
     */
    private function dispatchLocal(Event $event, EventMedia $media): void
    {
        $url = rtrim((string) config('services.face.local_url'), '/').'/index';
        $payload = [
            'event_id' => $event->id,
            'photo_id' => $media->id,
            'photo_sk' => $this->photoSk($media),
            'image_ref' => $this->imageRef($media->original_s3_path),
        ];

        app()->terminating(function () use ($url, $payload, $media) {
            try {
                Http::timeout(120)->post($url, $payload)->throw();
            } catch (Throwable $e) {
                report($e);
                Log::warning('Local face index failed', ['photo_id' => $media->id, 'error' => $e->getMessage()]);
            }
        });
    }

    private function photoSk(EventMedia $media): string
    {
        // The exact SK — the worker/Lambda updates this row's
        // processing_status and can't reconstruct the embedded timestamp.
        return 'PHOTO#'.$media->created_at.'#'.$media->id;
    }

    /**
     * How the local worker locates the file: a path on the shared volume
     * (FACE_IMAGE_BASE_URL=/photos) or an http(s) base — both are accepted.
     */
    private function imageRef(string $storagePath): string
    {
        return rtrim((string) config('services.face.image_base_url'), '/').'/'.ltrim($storagePath, '/');
    }
}
