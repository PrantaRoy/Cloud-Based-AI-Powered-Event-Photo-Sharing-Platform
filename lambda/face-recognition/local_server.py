"""
local_server.py
---------------
The same dlib / face_recognition logic as the two Lambda handlers, exposed
over plain HTTP for the local Docker stack — no AWS, no SQS, no Lambda.

Laravel calls this when FACE_LOCAL_URL is set (docker-compose.override.yml):

    POST /index    {event_id, photo_id, photo_sk, image_ref}
                   -> read the photo, write FACE#<photoId>#<idx> rows,
                      flip the photo's processing_status  (runs in a thread,
                      returns 202 immediately)
    POST /search   {event_id, selfie_ref, threshold?}
                   -> encode the selfie, Query the event's FACE# rows,
                      return matched photo ids (same JSON shape as the
                      search Lambda's output)
    GET  /health

`*_ref` is a local file path on the shared `face-media` volume (or an
http(s) URL — both work). DynamoDB is the local -inMemory container. Item
shapes are identical to face_index_handler.py so nothing downstream changes.
"""

import io
import json
import os
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import boto3
import face_recognition
import numpy as np
from PIL import Image, ImageOps

TABLE_NAME = os.environ.get("DYNAMODB_TABLE", "EventPhotoPlatform-local")
MODEL = os.environ.get("FACE_MATCH_MODEL", "hog")
PORT = int(os.environ.get("FACE_WORKER_PORT", "9000"))
DEFAULT_THRESHOLD = float(os.environ.get("FACE_MATCH_THRESHOLD", "0.55"))
MAX_EDGE = 1200

dynamodb = boto3.resource(
    "dynamodb",
    endpoint_url=os.environ["DYNAMODB_ENDPOINT"],
    region_name=os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-2"),
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", "local"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY", "local"),
)
table = dynamodb.Table(TABLE_NAME)


def _read_bytes(ref: str) -> bytes:
    """`ref` is either an http(s) URL or a local file path (shared volume)."""
    if ref.startswith(("http://", "https://")):
        with urllib.request.urlopen(ref, timeout=30) as resp:  # noqa: S310 - trusted compose network
            return resp.read()
    with open(ref, "rb") as fh:
        return fh.read()


def _fetch_image(ref: str) -> np.ndarray:
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(_read_bytes(ref)))).convert("RGB")
    w, h = img.size
    longest = max(w, h)
    if longest > MAX_EDGE:
        scale = MAX_EDGE / longest
        img = img.resize((int(w * scale), int(h * scale)))
    return np.array(img)


def _set_photo_status(event_id, photo_sk, **attrs):
    table.update_item(
        Key={"PK": f"EVENT#{event_id}", "SK": photo_sk},
        UpdateExpression="SET " + ", ".join(f"#{k} = :{k}" for k in attrs),
        ExpressionAttributeNames={f"#{k}": k for k in attrs},
        ExpressionAttributeValues={f":{k}": v for k, v in attrs.items()},
    )


def do_index(body: dict) -> dict:
    event_id, photo_id, photo_sk = body["event_id"], body["photo_id"], body["photo_sk"]
    now = int(time.time())
    try:
        image = _fetch_image(body["image_ref"])
        locations = face_recognition.face_locations(image, model=MODEL)
        encodings = face_recognition.face_encodings(image, locations)
    except Exception as exc:  # noqa: BLE001
        _set_photo_status(event_id, photo_sk, processing_status="failed", error_message=str(exc)[:500])
        return {"error": str(exc)}

    if not encodings:
        _set_photo_status(event_id, photo_sk, processing_status="no_faces", face_count=0, processed_at=now)
        return {"faces": 0}

    with table.batch_writer() as batch:
        for idx, (loc, enc) in enumerate(zip(locations, encodings)):
            top, right, bottom, left = loc
            batch.put_item(Item={
                "PK": f"EVENT#{event_id}",
                "SK": f"FACE#{photo_id}#{idx}",
                "entity_type": "face",
                "event_id": int(event_id),
                "photo_id": int(photo_id),
                "face_index": idx,
                "embedding": enc.astype(np.float32).tobytes(),
                "bounding_box": {"top": top, "right": right, "bottom": bottom, "left": left},
                "created_at": now,
            })

    _set_photo_status(event_id, photo_sk, processing_status="processed", face_count=len(encodings), processed_at=now)
    return {"faces": len(encodings)}


def do_search(body: dict) -> dict:
    event_id = str(body["event_id"])
    threshold = float(body.get("threshold", DEFAULT_THRESHOLD))

    image = _fetch_image(body["selfie_ref"])
    locations = face_recognition.face_locations(image, model="hog")
    if not locations:
        return {"error": "no_face_detected_in_selfie", "matchedPhotoIds": [], "matches": []}
    if len(locations) > 1:
        locations = [max(locations, key=lambda b: (b[2] - b[0]) * (b[1] - b[3]))]
    selfie_encoding = face_recognition.face_encodings(image, locations)[0]

    items, kwargs = [], {
        "KeyConditionExpression": boto3.dynamodb.conditions.Key("PK").eq(f"EVENT#{event_id}")
        & boto3.dynamodb.conditions.Key("SK").begins_with("FACE#")
    }
    while True:
        resp = table.query(**kwargs)
        items.extend(resp["Items"])
        if "LastEvaluatedKey" not in resp:
            break
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]

    if not items:
        return {"matchedPhotoIds": [], "matches": [], "facesInSelfie": 1}

    stored = np.array([np.frombuffer(bytes(f["embedding"]), dtype=np.float32) for f in items])
    distances = face_recognition.face_distance(stored, selfie_encoding)

    best: dict[str, float] = {}
    for face_item, dist in zip(items, distances):
        pid = str(face_item["photo_id"])
        if dist <= threshold and (pid not in best or dist < best[pid]):
            best[pid] = float(dist)

    matches = sorted(
        ({"photoId": pid, "distance": round(d, 4)} for pid, d in best.items()),
        key=lambda m: m["distance"],
    )
    return {
        "matchedPhotoIds": [m["photoId"] for m in matches],
        "matches": matches,
        "facesInSelfie": 1,
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: dict) -> None:
        data = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):  # noqa: N802
        if self.path == "/health":
            return self._send(200, {"ok": True})
        self._send(404, {"error": "not found"})

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._send(400, {"error": "invalid json"})

        # Indexing runs in a background thread and the request returns
        # immediately — the caller (Laravel, mid-upload-request on a
        # single-worker `artisan serve`) must not block on it, and the photo
        # row carries the result via processing_status.
        if self.path == "/index":
            threading.Thread(target=self._run_index, args=(body,), daemon=True).start()
            return self._send(202, {"queued": True})

        try:
            if self.path == "/search":
                return self._send(200, do_search(body))
        except Exception as exc:  # noqa: BLE001
            print("[face-worker] search error:", exc, flush=True)
            return self._send(500, {"error": str(exc)})
        self._send(404, {"error": "not found"})

    @staticmethod
    def _run_index(body: dict) -> None:
        try:
            result = do_index(body)
            print(f"[face-worker] index photo={body.get('photo_id')} -> {result}", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"[face-worker] index photo={body.get('photo_id')} FAILED: {exc}", flush=True)

    def log_message(self, fmt, *args):  # keep the log terse
        print("[face-worker]", fmt % args)


if __name__ == "__main__":
    sys.stdout.reconfigure(line_buffering=True)
    print(f"[face-worker] listening on :{PORT}  table={TABLE_NAME}  model={MODEL}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
