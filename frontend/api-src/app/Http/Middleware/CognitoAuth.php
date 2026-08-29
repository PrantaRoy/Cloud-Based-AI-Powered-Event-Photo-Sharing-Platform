<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CognitoAuth
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        // LOCAL DEV: accept any "local-dev-*" token, extract userId from it
        if (str_starts_with($token, 'local-dev-')) {
            $userId = str_replace('local-dev-', '', $token);
            $request->merge(['auth_user_id' => $userId, 'auth_email' => $userId . '@local.dev']);
            return $next($request);
        }

        // PRODUCTION: validate Cognito JWT
        // TODO: use firebase/php-jwt + Cognito JWKS endpoint to verify signature
        // $jwksUrl = "https://cognito-idp.{$region}.amazonaws.com/{$poolId}/.well-known/jwks.json";
        return response()->json(['error' => 'Invalid token'], 401);
    }
}
