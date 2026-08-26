<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;

class AuthController extends Controller
{
    /**
     * POST /api/auth/login
     * Local dev: returns a "local-dev-{email}" token.
     * Production: call Cognito InitiateAuth with USER_PASSWORD_AUTH flow.
     */
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        // LOCAL DEV ─ accept any credentials
        if (env('APP_ENV') === 'local') {
            $userId = strtolower(str_replace(['@', '.'], '-', $request->email));
            return response()->json([
                'token'   => 'local-dev-' . $userId,
                'user'    => ['id' => $userId, 'email' => $request->email],
                'message' => 'Local dev login – no Cognito validation',
            ]);
        }

        // PRODUCTION TODO:
        // $cognito = new \Aws\CognitoIdentityProvider\CognitoIdentityProviderClient([...]);
        // $result  = $cognito->initiateAuth([
        //     'AuthFlow'       => 'USER_PASSWORD_AUTH',
        //     'ClientId'       => env('COGNITO_CLIENT_ID'),
        //     'AuthParameters' => ['USERNAME' => $request->email, 'PASSWORD' => $request->password],
        // ]);
        // return response()->json(['token' => $result['AuthenticationResult']['IdToken']]);

        return response()->json(['error' => 'Cognito not configured'], 501);
    }

    /**
     * POST /api/auth/register
     */
    public function register(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|min:8',
            'name'     => 'required|string',
        ]);

        if (env('APP_ENV') === 'local') {
            return response()->json(['message' => 'Registered (local dev – no Cognito)']);
        }

        // PRODUCTION TODO: $cognito->signUp([...])
        return response()->json(['error' => 'Cognito not configured'], 501);
    }

    /**
     * POST /api/auth/change-password   [requires CognitoAuth middleware]
     */
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required',
            'new_password'     => 'required|min:8',
        ]);

        // PRODUCTION TODO: $cognito->changePassword([...])
        return response()->json(['message' => 'Password changed (stub)']);
    }
}
