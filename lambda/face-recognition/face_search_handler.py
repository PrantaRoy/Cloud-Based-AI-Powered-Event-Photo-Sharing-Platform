"""
face_search_handler.py
----------------------
Triggered by: a synchronous Lambda invoke from Laravel
(App\\Services\\Face\\FaceSearchClient) when an attendee uploads a reference
selfie to find the event photos they appear in.

Input event (from Laravel):
    {
      "eventId":   "12",
      "userId":    "45",
      "bucket":    "eventpro-media-123456789012",
      "selfieKey": "tmp/selfies/12/45-<uuid>.jpg",
      "threshold": 0.55            # optional, default below
    }

Output:
    {
      "matchedPhotoIds": ["7", "19", ...],
      "matches": [{"photoId": "7", "distance": 0.41}, ...],
      "facesInSelfie": 1
    }
or, when the selfie has no usable face:
    {"error": "no_face_detected_in_selfie", "matchedPhotoIds": [], "matches": []}

This function is DELIBERATELY read-only on DynamoDB (Query only). Laravel
persists the returned matches as MATCH# rows. The selfie is deleted from S3
here, right after it is read — it is never stored as an embedding.

Distance: face_recognition uses Euclidean distance between 128-d embeddings,
smaller = more similar. 0.6 is the library's "same person" default; 0.55 is
stricter and cuts false positives in crowded group shots.
"""

import io
import os

import boto3
import face_recognition
import numpy as np
from PIL import Image, ImageOps

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])

DEFAULT_THRESHOLD = float(os.environ.get("FACE_MATCH_THRESHOLD", "0.55"))


def _load_and_delete_selfie(bucket: str, key: str) -> np.ndarray:
    obj = s3.get_object(Bucket=bucket, Key=key)
    raw = obj["Body"].read()
    # Delete immediately — the selfie is only ever needed for this request.
    try:
        s3.delete_object(Bucket=bucket, Key=key)
    except Exception:  # noqa: BLE001 - best effort; a lifecycle rule backs this up
        pass
    img = Image.open(io.BytesIO(raw))
    img = ImageOps.exif_transpose(img)
    return np.array(img.convert("RGB"))


def _fetch_all_faces(event_id: str):
    """Every FACE# row for the event, in one partition Query (paginated)."""
    items = []
    key_cond = (
        boto3.dynamodb.conditions.Key("PK").eq(f"EVENT#{event_id}")
        & boto3.dynamodb.conditions.Key("SK").begins_with("FACE#")
    )
    kwargs = {"KeyConditionExpression": key_cond}
    while True:
        resp = table.query(**kwargs)
        items.extend(resp["Items"])
        if "LastEvaluatedKey" not in resp:
            break
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
    return items


def handler(event, context):
    event_id = str(event["eventId"])
    bucket = event["bucket"]
    selfie_key = event["selfieKey"]
    threshold = float(event.get("threshold", DEFAULT_THRESHOLD))

    selfie_image = _load_and_delete_selfie(bucket, selfie_key)
    selfie_locations = face_recognition.face_locations(selfie_image, model="hog")

    if not selfie_locations:
        return {"error": "no_face_detected_in_selfie", "matchedPhotoIds": [], "matches": []}

    # Multiple faces in the selfie (bad crop): use the largest, assume it's
    # the user, front and centre.
    if len(selfie_locations) > 1:
        selfie_locations = [max(
            selfie_locations,
            key=lambda b: (b[2] - b[0]) * (b[1] - b[3]),
        )]

    selfie_encoding = face_recognition.face_encodings(selfie_image, selfie_locations)[0]

    all_faces = _fetch_all_faces(event_id)
    if not all_faces:
        return {"matchedPhotoIds": [], "matches": [], "facesInSelfie": 1}

    stored = np.array([
        np.frombuffer(f["embedding"].value, dtype=np.float32) for f in all_faces
    ])
    distances = face_recognition.face_distance(stored, selfie_encoding)

    # Best (lowest-distance) hit per photo — a photo shouldn't rank twice
    # just because two similar faces are in it.
    best_per_photo: dict[str, float] = {}
    for face_item, dist in zip(all_faces, distances):
        photo_id = str(face_item["photo_id"])
        if dist <= threshold and (photo_id not in best_per_photo or dist < best_per_photo[photo_id]):
            best_per_photo[photo_id] = float(dist)

    matches = sorted(
        ({"photoId": pid, "distance": round(d, 4)} for pid, d in best_per_photo.items()),
        key=lambda m: m["distance"],
    )

    return {
        "matchedPhotoIds": [m["photoId"] for m in matches],
        "matches": matches,
        "facesInSelfie": 1,
    }
