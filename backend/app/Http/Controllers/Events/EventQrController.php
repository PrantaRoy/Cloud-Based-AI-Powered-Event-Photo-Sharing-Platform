<?php

namespace App\Http\Controllers\Events;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Support\QrCodeGenerator;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class EventQrController extends Controller
{
    /**
     * Return an SVG QR code that encodes the event's public shareable URL.
     *
     * Public by design: it only encodes a URL, and the page it points to
     * enforces the event's privacy. Returns a raw image, not the standard
     * JSON envelope.
     */
    public function __invoke(Request $request, Event $event): Response
    {
        $url = rtrim((string) config('app.frontend_url'), '/').'/e/'.$event->slug;

        $svg = QrCodeGenerator::svg($url);

        $headers = ['Content-Type' => 'image/svg+xml'];

        if ($request->boolean('download')) {
            $headers['Content-Disposition'] = 'attachment; filename="'.$event->slug.'-qr.svg"';
        }

        return response($svg, 200, $headers);
    }
}
