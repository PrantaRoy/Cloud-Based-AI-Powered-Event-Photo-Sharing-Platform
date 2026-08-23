# Technical Architecture Design
## Cloud-Based AI-Powered Event Photo Sharing Platform

**Course:** COMPX527 — Cloud Application Development
**Document type:** Technical architecture design (supplement to Task 1 proposal)
**Backend stack:** PHP 8.2 / Laravel 11 on EC2, DynamoDB, Python 3.11 Lambda container

---

## 1. Design constraints

Three constraints shape every decision below.

| Constraint | Source | Consequence |
|---|---|---|
| No RDBMS of any kind | Task 2 forbidden list | MySQL, Aurora and RDS are out. Laravel uses the AWS SDK for PHP against DynamoDB. |
| No Bedrock, SageMaker, Rekognition | Task 2 forbidden list / approval-gated | All inference runs as open-source code inside a Lambda container image. |
| NZD $60 total budget | Course budget | Favour serverless and pay-per-use. The ALB is the only always-billed resource and is torn down between work sessions. |

### 1.1 Change from the original plan

The original plan named **MySQL** as the datastore. This is not permissible — "RDBMS" appears on the forbidden services list, which covers MySQL whether self-hosted on EC2 or managed via RDS. All relational entities have been remodelled onto DynamoDB (Section 3).

The original plan also named **"free LLM tools"** for image classification. Any managed AI service (Bedrock, SageMaker, Rekognition) is forbidden or approval-gated, and an external LLM API would be an undeclared third-party dependency. Classification is instead performed by a small ONNX model executed in-process inside the Lambda container (Section 5.2).

---

## 2. Layered architecture

### 2.1 Edge and delivery layer

- **CloudFront** distribution with **Origin Access Control** in front of the derivatives S3 bucket. The bucket policy permits access only from the distribution, so no S3 object is ever publicly reachable.
- Serves thumbnails, watermarked previews and event banners. All gallery browsing traffic hits CloudFront, not EC2 — this is what keeps EC2 small.
- Original, unwatermarked files are **not** served through CloudFront. They are released only as short-lived pre-signed S3 URLs after a purchase is verified (Section 4.5).

### 2.2 Application layer

- **Application Load Balancer** in two availability zones, listening on HTTP/HTTPS, target group of **two `t3.micro` EC2 instances**. Two targets are required for the fault-tolerance claim in the proposal to be true; one target makes the ALB decorative.
- Each instance runs Nginx + PHP-FPM + Laravel 11. The application is stateless — sessions live in a Cognito-issued JWT, not on disk — so instances are interchangeable and can be replaced without data loss.
- ALB health check hits `GET /health`, which verifies DynamoDB and S3 reachability before returning 200.

### 2.3 Identity layer

- **Amazon Cognito user pool** handles registration, the verification email, password policy, password hashing and JWT issuance. Laravel never stores or sees a password.
- Laravel validates the Cognito JWT on every authenticated request using the pool's public JWKS.
- Two user categories, distinguished by a Cognito group claim: `organiser` (may create events) and `attendee` (may join and search). One person may hold both.

### 2.4 Asynchronous processing layer

- **SQS standard queue** buffers upload events, with a **dead-letter queue** after 3 failed receives so a single malformed image cannot block the pipeline.
- **Lambda container image** (up to 3 GB, well above the 250 MB zip limit that `dlib` breaches) subscribed to the queue. Reserved concurrency capped at 5 to bound cost.
- Timeout 120 s, memory 2048 MB — `dlib` face encoding is CPU-bound and Lambda scales CPU with memory, so 2048 MB is faster *and* cheaper per invocation than 512 MB.

### 2.5 Storage layer

Two buckets, deliberately separated because they have opposite access policies:

| Bucket | Contents | Access |
|---|---|---|
| `photos-originals` | Full-resolution uploads | Private. Pre-signed PUT for upload, pre-signed GET only after purchase. Never fronted by CloudFront. |
| `photos-derivatives` | Thumbnails, watermarked previews, banners, QR codes | Private bucket, read exclusively via CloudFront OAC. |

Lifecycle rule on `photos-originals`: transition to S3 Infrequent Access 30 days after event expiry, delete 90 days after expiry. This doubles as the privacy retention control (Section 7.3).

### 2.6 Observability layer

- **CloudWatch Logs** for Nginx, Laravel and Lambda.
- **CloudWatch alarms**: EC2 CPU > 80% for 5 min; SQS `ApproximateAgeOfOldestMessage` > 900 s (pipeline stalled); Lambda `Errors` > 0; DLQ `ApproximateNumberOfMessagesVisible` > 0; **AWS Budgets alarm at NZD $20, $35 and $50**.
- Custom metric `FacesDetectedPerPhoto` emitted by Lambda, used to spot detector regressions.

---

## 3. Data model (DynamoDB)

A **single-table design** with a generic partition/sort key and one global secondary index. This is the idiomatic DynamoDB approach and avoids five separate tables all needing their own capacity settings.

**Table:** `EventPhotoPlatform`
**Keys:** `PK` (partition), `SK` (sort)
**GSI1:** `GSI1PK` / `GSI1SK`
**Billing mode:** On-demand (no idle cost — important for the budget)

### 3.1 Entity map

| Entity | PK | SK | Key attributes |
|---|---|---|---|
| User profile | `USER#<cognitoSub>` | `PROFILE` | email, displayName, createdAt |
| Event | `EVENT#<eventId>` | `META` | name, description, venue, eventDate, expiryDate, privacy, bannerKey, coverKey, organiserSub, qrToken |
| Event membership | `EVENT#<eventId>` | `MEMBER#<cognitoSub>` | role, joinedAt, consentFacialMatching (bool), consentAt |
| Photo | `EVENT#<eventId>` | `PHOTO#<uploadedAt>#<photoId>` | s3Key, thumbKey, watermarkKey, uploaderSub, width, height, capturedAt, sceneLabel, faceCount, status |
| Face | `EVENT#<eventId>` | `FACE#<photoId>#<index>` | embedding (128 floats), boundingBox, clusterId |
| Face cluster (album) | `EVENT#<eventId>` | `CLUSTER#<clusterId>` | centroid, photoCount, coverPhotoId, claimedBySub |
| Purchase | `USER#<cognitoSub>` | `ORDER#<orderId>` | eventId, photoIds, amount, currency, status, providerRef, createdAt |

### 3.2 Access patterns

| # | Pattern | Query |
|---|---|---|
| 1 | Fetch event details | `PK = EVENT#<id>`, `SK = META` |
| 2 | List all photos in an event | `PK = EVENT#<id>`, `SK begins_with PHOTO#` |
| 3 | Load all face embeddings for matching | `PK = EVENT#<id>`, `SK begins_with FACE#` |
| 4 | Check a user is authorised for an event | `PK = EVENT#<id>`, `SK = MEMBER#<sub>` |
| 5 | List events a user belongs to | GSI1: `GSI1PK = USER#<sub>`, `GSI1SK begins_with EVENT#` |
| 6 | List a user's purchases | `PK = USER#<sub>`, `SK begins_with ORDER#` |
| 7 | List photos in one face album | `PK = EVENT#<id>`, `SK begins_with PHOTO#`, filter `clusterId` |

Every event-scoped entity shares the `EVENT#<eventId>` partition. This is the load-bearing decision: face matching (pattern 3) becomes a **single Query returning all embeddings for one event**, rather than a scan across the whole table.

### 3.3 Laravel integration

Eloquent cannot be used — it assumes SQL. Two workable options:

1. **AWS SDK for PHP directly** (`Aws\DynamoDb\DynamoDbClient`) wrapped in a thin repository class per entity. Verbose but transparent, no dependency risk, and the marshaler handles PHP↔DynamoDB type conversion.
2. **`baopham/laravel-dynamodb`**, which provides an Eloquent-like model layer over DynamoDB.

**Recommendation: option 1.** The package abstracts away exactly the single-table key design that earns marks, and adds a maintenance dependency for a 10-week project. Write five repository classes — `EventRepository`, `PhotoRepository`, `FaceRepository`, `MemberRepository`, `PurchaseRepository` — each with 4–6 methods.

---

## 4. Request flows

### 4.1 Registration and email verification

1. Browser POSTs email + password to Laravel.
2. Laravel calls Cognito `SignUp`. Cognito sends the verification email itself.
3. User clicks the link → Cognito `ConfirmSignUp`.
4. On first login Laravel writes the `USER#<sub> / PROFILE` item.

Passwords never reach Laravel storage. Cognito enforces the password policy and rate-limits brute force.

### 4.2 Event creation and QR generation

1. Authenticated organiser POSTs event metadata.
2. Laravel writes `EVENT#<id> / META` and `MEMBER#<organiserSub>` with role `organiser`.
3. Banner and cover images upload via pre-signed PUT to `photos-derivatives`.
4. Laravel generates a **signed join token**: an HMAC-SHA256 of `eventId | expiryDate`, keyed by a secret held in **Secrets Manager**. The QR encodes `https://<domain>/join/<eventId>?t=<token>`.
5. QR PNG is rendered server-side, stored in `photos-derivatives`, and offered as a CloudFront download.

The signature is what makes the QR an authorisation credential rather than a guessable URL. It expires with the event, so a photographed QR code is useless after the event closes.

### 4.3 Photo upload at the venue

1. Attendee scans the QR → hits `/join/<eventId>?t=<token>`.
2. Laravel verifies the HMAC and the expiry. Invalid or expired → 403.
3. If not signed in, redirect to Cognito, then back.
4. Laravel writes `MEMBER#<sub>` with role `uploader` **and records the facial-matching consent flag captured on this screen** (Section 7.3).
5. Laravel issues a pre-signed S3 PUT URL, scoped to one key, valid 15 minutes, with a content-length ceiling of 15 MB and a content-type condition of `image/jpeg` or `image/png`.
6. **The browser uploads directly to S3.** Bytes never transit EC2 — this is what allows two `t3.micro` instances to handle a venue full of phones.
7. S3 `ObjectCreated` event → SQS message.

### 4.4 Asynchronous processing (Lambda)

Per message:

1. Read the object from `photos-originals`.
2. Strip EXIF GPS coordinates, retain capture timestamp and orientation. (Uploaders routinely leak home coordinates in venue photos; this is a real privacy control, not a formality.)
3. Scene classification — indoor/outdoor and face-present/absent — via the ONNX model (Section 5.2). Write `sceneLabel`.
4. Face detection and 128-dimension encoding via `face_recognition` (HOG detector; CNN is far too slow for Lambda).
5. For each face, compare against existing cluster centroids for that event. Euclidean distance < 0.6 → assign to that cluster and update the centroid as a running mean. Otherwise create a new cluster.
6. Write one `FACE#` item per detected face; upsert `CLUSTER#` items.
7. Generate a 400 px thumbnail and a watermarked full-size preview; write both to `photos-derivatives`.
8. Update the `PHOTO#` item to `status = processed`.
9. If any cluster is already claimed by a registered user, publish to **SNS** → that user receives an email with a gallery link.

Idempotency: the handler checks `status` before writing. SQS is at-least-once, so a redelivered message must not create duplicate `FACE#` items.

### 4.5 Selfie search

1. Authenticated user selects an event. Laravel verifies `MEMBER#<sub>` exists — a user who never joined that event cannot search it.
2. User uploads a selfie via pre-signed PUT to a `tmp/` prefix with a **1-day lifecycle expiry**.
3. Laravel invokes a second Lambda (`SearchFunction`, synchronous, same container image) with the selfie key and event ID.
4. Lambda encodes the selfie, Queries all `FACE#` items for the event, and computes Euclidean distance against each.
5. Returns photo IDs where distance < 0.55 (tighter than the clustering threshold — a false positive here shows someone another person's photos, which is worse than a miss).
6. Lambda deletes the selfie immediately. **The selfie embedding is never persisted.**
7. Laravel returns CloudFront URLs for the watermarked previews.

**On brute-force matching:** at 128 floats per face, a 2,000-photo event with ~4,000 faces is roughly 2 MB of embeddings — one Query and a few milliseconds of NumPy. Vector search via OpenSearch would be the production answer and is on the permitted optional list, but its smallest instance would consume most of the NZD $60 budget. Brute force within an event partition is the correct engineering choice at this scale, and worth stating explicitly in the report as a reasoned trade-off rather than an oversight.

### 4.6 Download and payment

- **Watermarked:** served straight from CloudFront. Free, no gating beyond event membership.
- **Unwatermarked:** Laravel checks for a `status = paid` `ORDER#` item covering that photo. If absent, redirect to checkout. Payment is handled by an **external provider (Stripe)** — AWS has no permitted payment service, and the provider's hosted checkout means no card data ever touches your infrastructure.
- On webhook confirmation, Laravel writes the `ORDER#` item, then issues a **5-minute pre-signed GET** against `photos-originals`.
- Stripe secret key and webhook signing secret live in **Secrets Manager**, fetched at boot and cached in memory. Webhook signature verification is mandatory — an unverified webhook endpoint is a free-download vulnerability.

---

## 5. The Lambda container image

### 5.1 Build

```
FROM public.ecr.aws/lambda/python:3.11
RUN yum install -y cmake gcc-c++ make libpng-devel
RUN pip install dlib==19.24.2 face_recognition==1.3.0 \
    opencv-python-headless==4.9.0.80 Pillow==10.2.0 \
    onnxruntime==1.17.0 numpy==1.26.4 boto3
COPY app/ ${LAMBDA_TASK_ROOT}/
CMD ["handler.process"]
```

Image lands around 1.2 GB, pushed to ECR. `dlib` compiles from source and takes 10–20 minutes on first build — **do this in week 1, not week 6.** This is the single most likely component to stall the project, which is why the proposal's risk register already flags it.

Mitigate cold starts (5–8 s while `dlib` loads) with provisioned concurrency of 1 **during the demo only** — it bills hourly and must be switched off afterwards.

### 5.2 Scene classification without an LLM

Use **MobileNetV2 exported to ONNX**, executed via `onnxruntime` inside the same container. Two outputs:

- Indoor/outdoor: a binary head fine-tuned on Open Images scene labels.
- Face present/absent: taken directly from the `face_recognition` detector's face count — no separate model needed.

Roughly 30 ms per image on Lambda, no network call, no API key, no forbidden service.

### 5.3 Open Images as a genuine dependency

Open Images V7 carries annotated `Human face` bounding boxes. Sample ~500 annotated images from the AWS Open Data Registry bucket, run your `face_recognition` HOG detector over them, and compute precision and recall against the ground-truth boxes.

This gives you three things a marker will look for: a defensible reason the public dataset is present, a quantitative detector figure to report, and a documented threshold-tuning method for the 0.55 and 0.6 distance cut-offs above. It converts the weakest paragraph in the proposal into a measurable result.

---

## 6. IAM design

Least privilege must be *demonstrated*, not asserted. Managed full-access policies (`AmazonS3FullAccess` and similar) contradict the claim and will be flagged.

### 6.1 Service roles

| Role | Permissions |
|---|---|
| `EC2-LaravelRole` | `dynamodb:GetItem/PutItem/UpdateItem/Query` on the table ARN + its GSI only; `s3:PutObject/GetObject` on the two bucket ARNs; `sqs:SendMessage` on the queue ARN; `secretsmanager:GetSecretValue` on two specific secret ARNs; `sns:Publish` on the topic ARN; `cognito-idp:AdminGetUser`. No `Scan`, no `DeleteTable`, no wildcards. |
| `Lambda-ProcessorRole` | `s3:GetObject` on `photos-originals/*`; `s3:PutObject` on `photos-derivatives/*`; `dynamodb:PutItem/UpdateItem/Query` on the table ARN; `sqs:ReceiveMessage/DeleteMessage/GetQueueAttributes`; `sns:Publish`; `logs:*` on its own log group. |
| `Lambda-SearchRole` | `s3:GetObject` and `s3:DeleteObject` on `photos-originals/tmp/*` only; `dynamodb:Query` on the table ARN. Read-only against everything else. |

### 6.2 Human roles

| IAM role | Team member | Scope |
|---|---|---|
| `TeamLead-Admin` | Pranta | Full account admin, billing, IAM management |
| `Backend-Dev` | Saleh | EC2, ALB, Auto Scaling, CloudWatch Logs read |
| `Pipeline-Dev` | Jay | Lambda, ECR, SQS, DynamoDB |
| `Storage-Dev` | Aditya | S3, CloudFront, SNS |
| `Frontend-QA` | Ishrat | CloudWatch read-only, S3 read-only, no write to production |

MFA enforced on all console users. Root account used only for initial setup, then locked away.

---

## 7. Security and privacy

### 7.1 Data in transit
HTTPS on the ALB listener and CloudFront. (Note: ACM is on the forbidden list, so plan for an ALB DNS name with a self-signed or CloudFront default certificate, and document this constraint explicitly rather than leaving the gap unexplained.)

### 7.2 Data at rest
SSE-S3 on both buckets, encryption at rest on DynamoDB (on by default), block-public-access enabled on both buckets.

### 7.3 Biometric consent — Privacy Act 2020

This is the most likely question in a viva, and the current proposal does not answer it.

Face embeddings are biometric information. The Act requires that collection be for a lawful purpose, that the individual be informed, and that the data be retained no longer than necessary.

Controls:

1. **Consent at join time.** The QR join screen states plainly that photos will be analysed for facial matching, and requires an explicit opt-in checkbox before upload is enabled. The flag is stored on the `MEMBER#` item with a timestamp.
2. **Non-members in photos.** Faces belonging to people who never joined the event still get clustered — this is unavoidable in crowd photography. Mitigation: unclaimed clusters are **deleted when the event expires**, so no embedding for a non-consenting person persists beyond the event.
3. **Retention.** Lifecycle rules delete originals 90 days after event expiry; a scheduled cleanup removes `FACE#` and `CLUSTER#` items on the same schedule.
4. **Selfie handling.** Never stored, never persisted as an embedding, deleted within the request.
5. **Takedown.** Organisers can delete any photo; deleting a photo cascades to its `FACE#` items.

Document these five points in the final report. A marker on a security-oriented paper will look for exactly this, and "we store it privately in S3" is not an answer to a consent question.

### 7.4 Abuse controls
Rate-limit uploads per member per event (Laravel middleware). Validate magic bytes server-side in Lambda, not just the client-declared MIME type. Cap image dimensions before decode to prevent decompression-bomb attacks.

---

## 8. Cost model (NZD, ~10 weeks)

| Resource | Assumption | Est. cost |
|---|---|---|
| ALB | ~60 hours active (not left running) | $2.50 |
| EC2 2 × t3.micro | ~120 instance-hours | $4.00 |
| S3 | 5 GB storage + requests | $0.30 |
| DynamoDB on-demand | Low thousands of ops | $0.50 |
| Lambda | ~2,000 invocations @ 2 GB / 8 s | $0.90 |
| ECR | 1.2 GB image | $0.20 |
| CloudFront | < 5 GB transfer | Free tier |
| SQS / SNS / CloudWatch / Cognito | Low volume | Free tier |
| **Total** | | **≈ $8.40** |

**The dominant risk is leaving the ALB and EC2 running.** An ALB left up for the full 10 weeks costs roughly $40 by itself — two thirds of the budget for an idle resource. Only the Team Lead provisions the ALB; teardown is part of every session's checklist. Budget alarms at $20 / $35 / $50 provide the safety net.

---

## 9. Build order

The dependency chain matters more than the calendar. Build in this order:

1. **Lambda container with `dlib`, proven to build and invoke.** Everything downstream depends on it and it is the component most likely to fail. If it cannot be made to work, you need to know in week 1 while a fallback is still possible.
2. DynamoDB table + repository classes. Freeze the key schema before parallel work starts.
3. Cognito pool + Laravel auth integration.
4. EC2 + ALB + pre-signed upload flow.
5. S3 → SQS → Lambda wiring end to end.
6. Clustering, thumbnails, watermarking.
7. Selfie search.
8. CloudFront, SNS, payment.
9. IAM tightening, CloudWatch alarms, Open Images validation run.

Items 2 and 3 can proceed in parallel with 1. Nothing after 5 can start until 5 works.
