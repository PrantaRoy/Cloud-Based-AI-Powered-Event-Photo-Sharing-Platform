<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\DynamoService;
use Aws\S3\S3Client;
use Aws\Sqs\SqsClient;
use Illuminate\Support\Str;

class PhotoController extends Controller
{
    public function __construct(protected DynamoService $dynamo) {}

    protected function s3Client(): S3Client
    {
        $config = [
            'region'      => env('AWS_DEFAULT_REGION', 'ap-southeast-2'),
            'version'     => 'latest',
            'credentials' => [
                'key'    => env('AWS_ACCESS_KEY_ID', 'local'),
                'secret' => env('AWS_SECRET_ACCESS_KEY', 'local'),
            ],
        ];
        if ($endpoint = env('S3_ENDPOINT')) {
            $config['endpoint'] = $endpoint;
            $config['use_path_style_endpoint'] = true;
        }
        return new S3Client($config);
    }

    protected function sqsClient(): SqsClient
    {
        $config = [
            'region'      => env('AWS_DEFAULT_REGION', 'ap-southeast-2'),
            'version'     => 'latest',
            'credentials' => [
                'key'    => env('AWS_ACCESS_KEY_ID', 'local'),
                'secret' => env('AWS_SECRET_ACCESS_KEY', 'local'),
            ],
        ];
        if ($endpoint = env('SQS_ENDPOINT')) {
            $config['endpoint'] = $endpoint;
        }
        return new SqsClient($config);
    }

    /**
     * POST /api/events/{id}/upload-url
     * Returns a pre-signed S3 PUT URL for direct browser upload.
     * Local dev: returns a stub URL (no real S3 bucket).
     */
    public function presignedUrl(Request $request, string $id)
    {
        $request->validate(['filename' => 'required|string', 'mime' => 'required|string']);

        $photoId = 'photo-' . Str::uuid();
        $s3Key   = "originals/{$id}/{$photoId}/" . $request->filename;
        $bucket  = env('S3_BUCKET', 'eventpro-photos');

        if (env('APP_ENV') === 'local' && !env('S3_ENDPOINT')) {
            // Stub for local dev without LocalStack
            return response()->json([
                'photoId'     => $photoId,
                'uploadUrl'   => 'http://localhost:8001/stub-upload/' . $s3Key,
                'key'         => $s3Key,
                'note'        => 'Local dev stub — no real S3 upload will occur',
            ]);
        }

        $cmd = $this->s3Client()->getCommand('PutObject', [
            'Bucket'      => $bucket,
            'Key'         => $s3Key,
            'ContentType' => $request->mime,
        ]);
        $presigned = $this->s3Client()->createPresignedRequest($cmd, '+15 minutes');

        return response()->json([
            'photoId'   => $photoId,
            'uploadUrl' => (string) $presigned->getUri(),
            'key'       => $s3Key,
        ]);
    }

    /**
     * POST /api/events/{id}/uploaded
     * Called after the browser finishes uploading to S3.
     * Records the photo in DynamoDB and enqueues an SQS job for the AI pipeline.
     */
    public function uploaded(Request $request, string $id)
    {
        $request->validate(['photoId' => 'required|string', 'key' => 'required|string']);

        $photo = [
            'photoId'      => $request->photoId,
            'eventId'      => $id,
            's3Key'        => $request->key,
            'thumbKey'     => null,  // filled in by Lambda after processing
            'uploadedBy'   => $request->auth_user_id,
            'uploadedAt'   => now()->toIso8601String(),
            'matchedUsers' => [],
            'processed'    => false,
        ];

        $this->dynamo->putPhoto($photo);

        // Enqueue SQS job for Lambda AI pipeline
        if (env('APP_ENV') !== 'local' || env('SQS_ENDPOINT')) {
            $this->sqsClient()->sendMessage([
                'QueueUrl'    => env('SQS_QUEUE_URL'),
                'MessageBody' => json_encode([
                    'action'  => 'process_photo',
                    'photoId' => $photo['photoId'],
                    'eventId' => $id,
                    's3Key'   => $photo['s3Key'],
                ]),
            ]);
        }

        return response()->json(['message' => 'Photo queued for processing', 'photo' => $photo], 201);
    }

    /**
     * GET /api/gallery/{event_id}
     * Returns all photos for an event (public).
     */
    public function gallery(string $eventId)
    {
        $photos = $this->dynamo->getPhotosByEvent($eventId);
        return response()->json($photos);
    }

    /**
     * GET /api/photos/mine
     * Returns all photos where auth_user_id is in matchedUsers.
     */
    public function mine(Request $request)
    {
        // TODO: use a GSI on Photos table keyed by matchedUsers
        // For now return empty array — Lambda fills this after face matching
        return response()->json([]);
    }

    /**
     * POST /api/search/selfie
     * Upload a selfie → Lambda does face search → returns matching photo URLs.
     * Local dev: returns stub results.
     */
    public function searchBySelfie(Request $request)
    {
        $request->validate(['event_id' => 'required|string']);

        if (env('APP_ENV') === 'local' && !env('S3_ENDPOINT')) {
            return response()->json([
                'matches' => [],
                'note'    => 'Local dev stub — Lambda face search not available without AWS',
            ]);
        }

        // PRODUCTION:
        // 1. Upload selfie to S3 temp-selfies/{uuid}.jpg
        // 2. Invoke Lambda synchronously (RequestResponse) with selfie key + event_id
        // 3. Lambda returns array of matching photoIds
        // 4. Fetch photo records from DynamoDB
        // 5. Generate CloudFront signed URLs for thumbs
        // TODO: implement above

        return response()->json(['matches' => [], 'note' => 'Not yet implemented in production']);
    }
}
