"""
Local smoke tests for the two Lambda handlers — no real Lambda, no dlib.

Run:
    cd lambda/face-recognition
    pip install -r requirements.txt moto pytest        # dlib build ~10 min
    pytest

Faster path (skips the dlib install): these tests stub the `face_recognition`
module, so you can run them with just:
    pip install moto pytest numpy pillow boto3
    pytest

They verify the S3 -> DynamoDB wiring and the FACE# / status item shapes.
Accuracy of the actual detector is validated separately (see the
architecture doc §5.3 — Open Images V7 `Human face` boxes).
"""

import importlib
import io
import json
import os
import sys
import types

import boto3
import numpy as np
import pytest
from PIL import Image

TABLE_NAME = "EventPhotoPlatform-test"
BUCKET = "eventpro-media-test"
REGION = "ap-southeast-2"

moto = pytest.importorskip("moto")


def _fake_face_recognition(num_faces: int):
    mod = types.ModuleType("face_recognition")
    mod.face_locations = lambda img, model="hog": [(10, 90, 90, 10)] * num_faces
    mod.face_encodings = lambda img, locs: [np.full(128, i, dtype=np.float64) for i in range(len(locs))]
    mod.face_distance = lambda known, unknown: np.linalg.norm(np.array(known) - unknown, axis=1)
    return mod


def _png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (200, 200), (127, 127, 127)).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def aws(monkeypatch):
    os.environ.update(
        TABLE_NAME=TABLE_NAME, AWS_DEFAULT_REGION=REGION,
        AWS_ACCESS_KEY_ID="test", AWS_SECRET_ACCESS_KEY="test",
    )
    with moto.mock_aws():
        ddb = boto3.client("dynamodb", region_name=REGION)
        ddb.create_table(
            TableName=TABLE_NAME,
            BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[
                {"AttributeName": "PK", "AttributeType": "S"},
                {"AttributeName": "SK", "AttributeType": "S"},
            ],
            KeySchema=[
                {"AttributeName": "PK", "KeyType": "HASH"},
                {"AttributeName": "SK", "KeyType": "RANGE"},
            ],
        )
        s3 = boto3.client("s3", region_name=REGION)
        s3.create_bucket(
            Bucket=BUCKET,
            CreateBucketConfiguration={"LocationConstraint": REGION},
        )
        yield boto3.resource("dynamodb", region_name=REGION).Table(TABLE_NAME), s3


def _load(handler_module: str, num_faces: int, monkeypatch):
    monkeypatch.setitem(sys.modules, "face_recognition", _fake_face_recognition(num_faces))
    sys.modules.pop(handler_module, None)
    return importlib.import_module(handler_module)


def test_index_writes_one_face_row_per_face_and_marks_processed(aws, monkeypatch):
    table, s3 = aws
    s3.put_object(Bucket=BUCKET, Key="event-media/12/p.png", Body=_png_bytes())
    photo_sk = "PHOTO#2026-09-09T00:00:00+00:00#45"
    table.put_item(Item={"PK": "EVENT#12", "SK": photo_sk, "entity_type": "photo",
                         "id": 45, "event_id": 12, "processing_status": "queued"})

    mod = _load("face_index_handler", 3, monkeypatch)
    sqs_event = {"Records": [{"body": json.dumps({
        "event_id": 12, "photo_id": 45, "photo_sk": photo_sk,
        "bucket": BUCKET, "key": "event-media/12/p.png",
    })}]}

    out = mod.handler(sqs_event, None)
    assert out["processed"][0]["faces"] == 3

    faces = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key("PK").eq("EVENT#12")
        & boto3.dynamodb.conditions.Key("SK").begins_with("FACE#45#")
    )["Items"]
    assert len(faces) == 3
    assert faces[0]["entity_type"] == "face"
    assert len(bytes(faces[0]["embedding"])) == 128 * 4  # float32

    photo = table.get_item(Key={"PK": "EVENT#12", "SK": photo_sk})["Item"]
    assert photo["processing_status"] == "processed"
    assert photo["face_count"] == 3


def test_index_marks_no_faces_when_none_detected(aws, monkeypatch):
    table, s3 = aws
    s3.put_object(Bucket=BUCKET, Key="event-media/12/q.png", Body=_png_bytes())
    photo_sk = "PHOTO#2026-09-09T00:00:00+00:00#46"
    table.put_item(Item={"PK": "EVENT#12", "SK": photo_sk, "entity_type": "photo",
                         "id": 46, "event_id": 12, "processing_status": "queued"})

    mod = _load("face_index_handler", 0, monkeypatch)
    mod.handler({"Records": [{"body": json.dumps({
        "event_id": 12, "photo_id": 46, "photo_sk": photo_sk,
        "bucket": BUCKET, "key": "event-media/12/q.png",
    })}]}, None)

    photo = table.get_item(Key={"PK": "EVENT#12", "SK": photo_sk})["Item"]
    assert photo["processing_status"] == "no_faces"


def test_search_returns_matches_and_deletes_the_selfie(aws, monkeypatch):
    table, s3 = aws
    # Two indexed faces: photo 7 embedding ~0, photo 8 embedding ~5.
    for pid, val in [(7, 0.0), (8, 5.0)]:
        table.put_item(Item={
            "PK": "EVENT#12", "SK": f"FACE#{pid}#0", "entity_type": "face",
            "event_id": 12, "photo_id": pid, "face_index": 0,
            "embedding": np.full(128, val, dtype=np.float32).tobytes(),
        })
    s3.put_object(Bucket=BUCKET, Key="tmp/selfies/12/45-abc.jpg", Body=_png_bytes())

    mod = _load("face_search_handler", 1, monkeypatch)
    # fake encoding for the selfie is all-zeros -> matches photo 7, not 8.
    out = mod.handler({
        "eventId": "12", "userId": "45", "bucket": BUCKET,
        "selfieKey": "tmp/selfies/12/45-abc.jpg", "threshold": 0.55,
    }, None)

    assert out["matchedPhotoIds"] == ["7"]
    with pytest.raises(s3.exceptions.ClientError):
        s3.head_object(Bucket=BUCKET, Key="tmp/selfies/12/45-abc.jpg")


def test_search_reports_no_face_in_selfie(aws, monkeypatch):
    table, s3 = aws
    s3.put_object(Bucket=BUCKET, Key="tmp/selfies/12/45-x.jpg", Body=_png_bytes())
    mod = _load("face_search_handler", 0, monkeypatch)
    out = mod.handler({
        "eventId": "12", "userId": "45", "bucket": BUCKET,
        "selfieKey": "tmp/selfies/12/45-x.jpg",
    }, None)
    assert out["error"] == "no_face_detected_in_selfie"
