"""
face_index_handler.py
---------------------
Triggered by: SQS, one message per uploaded event photo. Laravel
(App\\Services\\Face\\FaceIndexDispatcher) puts the message on the queue right
after the photo is written to S3.

Message body (always this shape — we enqueue from Laravel, not S3 -> SQS):
    {
      "event_id": 12,
      "photo_id": 45,
      "photo_sk": "PHOTO#2026-09-09T04:12:33+00:00#45",
      "bucket":   "eventpro-media-123456789012",
      "key":      "event-media/12/ab12cd34.jpg"
    }

Responsibilities:
  1. Download the photo from S3.
  2. Detect every face (single portraits AND group photos).
  3. Compute a 128-d embedding per face.
  4. Write one FACE# row per face, then update the photo's processing_status.

Item shape (matches the Laravel single-table conventions — snake_case,
entity_type, no GSI attributes on FACE rows):
    PK           = EVENT#<event_id>
    SK           = FACE#<photo_id>#<index>
    entity_type  = face
    embedding    = <Binary>  (128 x float32)
    bounding_box = {top, right, bottom, left}

Env vars:
  TABLE_NAME        - DynamoDB table
  FACE_MATCH_MODEL  - "hog" (default, CPU) or "cnn" (needs a GPU Lambda)
"""

import json
import io
import os
import time

import boto3
import face_recognition
import numpy as np
from PIL import Image, ImageOps

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])
MODEL = os.environ.get("FACE_MATCH_MODEL", "hog")

# Cap the longest edge before detection. Detection cost scales with pixel
# count and event photos are often 3000px+; 1200px keeps it fast without
# meaningfully hurting accuracy for reasonably-sized faces.
MAX_EDGE = 1200


def _load_image_from_s3(bucket: str, key: str) -> np.ndarray:
    obj = s3.get_object(Bucket=bucket, Key=key)
    img = Image.open(io.BytesIO(obj["Body"].read()))
    img = ImageOps.exif_transpose(img)  # respect phone orientation
    img = img.convert("RGB")

    w, h = img.size
    longest = max(w, h)
    if longest > MAX_EDGE:
        scale = MAX_EDGE / longest
        img = img.resize((int(w * scale), int(h * scale)))

    return np.array(img)


def _encode_embedding(vec: np.ndarray) -> bytes:
    # 128 float64 -> float32 halves storage with no meaningful accuracy loss
    return vec.astype(np.float32).tobytes()


def _set_photo_status(event_id, photo_sk: str, **attrs) -> None:
    names = {f"#{k}": k for k in attrs}
    values = {f":{k}": v for k, v in attrs.items()}
    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in attrs)
    table.update_item(
        Key={"PK": f"EVENT#{event_id}", "SK": photo_sk},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


def _process_one_photo(bucket, key, event_id, photo_id, photo_sk) -> dict:
    image = _load_image_from_s3(bucket, key)

    face_locations = face_recognition.face_locations(image, model=MODEL)
    face_encodings = face_recognition.face_encodings(image, face_locations)
    now = int(time.time())

    if not face_encodings:
        _set_photo_status(
            event_id, photo_sk,
            processing_status="no_faces", face_count=0, processed_at=now,
        )
        return {"photoId": photo_id, "faces": 0}

    with table.batch_writer() as batch:
        for idx, (loc, enc) in enumerate(zip(face_locations, face_encodings)):
            top, right, bottom, left = loc
            batch.put_item(Item={
                "PK": f"EVENT#{event_id}",
                "SK": f"FACE#{photo_id}#{idx}",
                "entity_type": "face",
                "event_id": int(event_id),
                "photo_id": int(photo_id),
                "face_index": idx,
                "embedding": _encode_embedding(enc),  # DynamoDB Binary
                "bounding_box": {
                    "top": top, "right": right, "bottom": bottom, "left": left,
                },
                "created_at": now,
            })

    _set_photo_status(
        event_id, photo_sk,
        processing_status="processed", face_count=len(face_encodings), processed_at=now,
    )
    return {"photoId": photo_id, "faces": len(face_encodings)}


def handler(sqs_event, context):
    results = []
    for record in sqs_event["Records"]:
        body = json.loads(record["body"])
        bucket = body["bucket"]
        key = body["key"]
        event_id = body["event_id"]
        photo_id = body["photo_id"]
        photo_sk = body["photo_sk"]

        try:
            results.append(_process_one_photo(bucket, key, event_id, photo_id, photo_sk))
        except Exception as exc:  # noqa: BLE001
            _set_photo_status(
                event_id, photo_sk,
                processing_status="failed", error_message=str(exc)[:500],
            )
            raise  # let SQS retry, then the DLQ (maxReceiveCount=3) catch it

    return {"processed": results}
