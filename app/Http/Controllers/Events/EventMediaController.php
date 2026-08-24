<?php

namespace App\Http\Controllers\Events;

use App\Actions\Events\UploadEventMedia;
use App\Http\Controllers\Controller;
use App\Http\Requests\Events\StoreEventMediaRequest;
use App\Http\Resources\EventMediaResource;
use App\Models\Event;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class EventMediaController extends Controller
{
    public function store(StoreEventMediaRequest $request, Event $event, UploadEventMedia $uploadEventMedia)
    {
        Gate::authorize('uploadMedia', $event);

        $media = $uploadEventMedia->handle($event, $request->user(), $request->file('photo'));

        return (new EventMediaResource($media->load('uploader')))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }
}
