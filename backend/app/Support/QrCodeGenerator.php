<?php

namespace App\Support;

use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

class QrCodeGenerator
{
    /**
     * Render the given text as an SVG QR code (pure PHP, no image extension).
     */
    public static function svg(string $text, int $size = 320, int $margin = 1): string
    {
        $writer = new Writer(new ImageRenderer(
            new RendererStyle($size, $margin),
            new SvgImageBackEnd,
        ));

        return $writer->writeString($text);
    }
}
