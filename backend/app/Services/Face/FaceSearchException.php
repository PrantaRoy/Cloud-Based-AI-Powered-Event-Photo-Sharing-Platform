<?php

namespace App\Services\Face;

use RuntimeException;

/**
 * The face-search Lambda returned an error (or was unreachable). Surfaced
 * to the controller as a 502 so the SPA can distinguish "search broke" from
 * "no matches found".
 */
class FaceSearchException extends RuntimeException {}
