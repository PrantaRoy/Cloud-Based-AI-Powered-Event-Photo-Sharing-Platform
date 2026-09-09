<?php

namespace App\Providers;

use Aws\Lambda\LambdaClient;
use Aws\Sqs\SqsClient;
use Illuminate\Support\ServiceProvider;

/**
 * Binds the two AWS clients the face-matching pipeline talks to:
 *   - SQS   — enqueue a photo for face indexing after upload
 *   - Lambda — synchronous "search by selfie" invoke
 *
 * Built from config('services.face'), mirroring how RepositoryServiceProvider
 * builds DynamoClient: explicit key/secret only when provided (local/CI),
 * otherwise the default SDK credential chain (EC2 instance role in prod).
 */
class FaceServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(SqsClient::class, function ($app) {
            return new SqsClient($this->sdkConfig($app['config']->get('services.face'), '2012-11-05'));
        });

        $this->app->singleton(LambdaClient::class, function ($app) {
            return new LambdaClient($this->sdkConfig($app['config']->get('services.face'), '2015-03-31'));
        });
    }

    /**
     * @param  array<string, mixed>  $face
     * @return array<string, mixed>
     */
    private function sdkConfig(array $face, string $version): array
    {
        $config = [
            'region' => (string) ($face['region'] ?? 'ap-southeast-2'),
            'version' => $version,
        ];

        $key = $face['key'] ?? null;
        $secret = $face['secret'] ?? null;
        if (! empty($key) && ! empty($secret) && $key !== 'local') {
            $config['credentials'] = ['key' => (string) $key, 'secret' => (string) $secret];
        }

        return $config;
    }
}
