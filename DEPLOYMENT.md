# EventPro — Deployment Guide

Two environments:

| | Stack | Data store | Time to stand up |
|---|---|---|---|
| **Local (Docker)** | DynamoDB-local + Laravel API + Vite dev server | In-memory, resets on stop | ~5 min |
| **AWS** | EC2 (Docker) behind an ALB, real DynamoDB + S3, SPA on S3+CloudFront | Persistent | ~60–90 min |

The backend is **Laravel 13, DynamoDB-only (no RDBMS)**. The frontend is a **React + Vite SPA**
that talks to the API over HTTP with a bearer token.

**Auth has two modes, chosen automatically by whether `COGNITO_USER_POOL_ID` is set:**

| Mode | When | How |
|---|---|---|
| **Local** | `COGNITO_USER_POOL_ID` blank — local dev, Docker, CI | passwords + HS256 JWT handled in-app |
| **Cognito** | pool configured — AWS | Amazon Cognito owns sign-up, password policy, email verification and JWT issuance; the API verifies Cognito's RS256 tokens against the pool JWKS |

The API contract (`/api/register`, `/api/login`, bearer token, `{user, token}`) is
**identical in both modes** — the SPA never knows the difference.

---

# Part 1 — Local with Docker

## 1.1 Prerequisites

- **Docker Desktop** running (`docker version` succeeds).
  On this machine the CLI is at `~/.docker/bin/docker` and is **not on `PATH`** — either add it:
  ```bash
  echo 'export PATH="$HOME/.docker/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
  ```
  or prefix every command with `PATH="$HOME/.docker/bin:$PATH"`.
- Ports **8000**, **5173**, **8001** free on the host.
- ~2 GB free disk for the images.

## 1.2 What `docker compose up` starts

Defined in [`docker-compose.yml`](docker-compose.yml):

| Service | Image / build | Host port | Role |
|---|---|---|---|
| `dynamodb` | `amazon/dynamodb-local` | 8001 → 8000 | DynamoDB, `-inMemory` (wiped on stop) |
| `migrate` | `./backend` | — | runs `php artisan dynamo:create-table`, then exits |
| `backend` | `./backend` ([Dockerfile](backend/Dockerfile)) | 8000 | Laravel API (`php artisan serve`) |
| `frontend` | `./frontend` ([Dockerfile](frontend/Dockerfile)) | 5173 | Vite dev server |
| `seed` | `./backend` | — | on-demand demo data (profile `tools`) |

All backend env is inlined in the compose file (`x-api-env`), so **no `.env` file is needed** for the Docker path. `APP_KEY` and `JWT_SECRET` there are throwaway demo values.

## 1.3 Start it

```bash
cd "/Users/prantaroy/Academic Project/eventpro"
docker compose up -d --build          # first run builds images (~3–4 min)
docker compose run --rm seed          # load demo data
```

Then open:

| URL | What |
|---|---|
| http://localhost:5173 | The app |
| http://localhost:8000/up | API health check (`200`) |
| http://localhost:8000/api/events/public | API sanity check (JSON) |

**Demo login:** `admin@eventpro.com` / `password`
(The seed also creates 6 organisers + 40 visitors, all with password `password`.)

## 1.4 Everyday commands

```bash
docker compose ps                                  # status
docker compose logs -f backend                     # tail API logs
docker compose logs -f frontend                    # tail Vite logs
docker compose exec backend sh                     # shell into the API container
docker compose exec backend php artisan route:list
docker compose run --rm seed                       # re-seed (wipes + reloads)
docker compose exec backend php artisan dynamo:create-table   # recreate table

docker compose restart backend                     # after an env tweak in compose
docker compose up -d --build backend               # after a code change
docker compose down                                # stop (DynamoDB data is lost)
docker compose down --rmi local -v                 # stop + delete images + volumes
```

Because DynamoDB is `-inMemory`, **every `docker compose down` clears all data** — re-run the `seed` step after each `up`.

## 1.5 Run the test suite

The tests need a DynamoDB endpoint. Easiest is against the running compose stack:

```bash
docker compose exec backend composer ci:check      # pint + phpstan + phpunit
# or just the tests:
docker compose exec backend php artisan test
```

To run them **outside** Docker you need a local `dynamodb-local` on port 8001
(`phpunit.xml` points there) and PHP 8.4+:

```bash
docker run -d --name ddb-test -p 8001:8000 amazon/dynamodb-local -jar DynamoDBLocal.jar -sharedDb -inMemory
cd backend && composer ci:check
docker rm -f ddb-test
```

## 1.6 Running locally **without** Docker

```bash
# 1. DynamoDB-local
docker run -d --name eventpro-ddb -p 8001:8000 amazon/dynamodb-local -jar DynamoDBLocal.jar -sharedDb -inMemory

# 2. Backend
cd backend
cp .env.example .env
php artisan key:generate
php artisan storage:link          # so uploaded images are servable via `artisan serve`
php artisan dynamo:setup --seed   # create table + demo data
php artisan serve                 # http://localhost:8000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env              # VITE_API_URL=http://localhost:8000/api
npm install
npm run dev                       # http://localhost:5173
```

`backend/.env.example` already has `DYNAMODB_ENDPOINT=http://localhost:8001` and
`FILESYSTEM_DISK=s3` — for non-Docker local dev set `FILESYSTEM_DISK=public` so
uploads land on local disk and are served by the `storage:link` symlink.

## 1.7 Troubleshooting (local)

| Symptom | Cause / fix |
|---|---|
| `Bind for 0.0.0.0:8001 failed: port is already allocated` | A stray `dynamodb-local` container. `docker rm -f eventpro-ddb ddb-test 2>/dev/null; docker compose down --remove-orphans` then `up`. Or change the left-hand port under `dynamodb:` in `docker-compose.yml` (e.g. `"8002:8000"`). |
| `migrate` loops on `Could not resolve host: dynamodb` | Half-created Docker network (usually after Docker Desktop restarts). `docker compose down --remove-orphans && docker compose up -d`. |
| Uploaded images 403 in the app | The API container needs `php artisan storage:link` — it's in the Dockerfile `CMD`; rebuild: `docker compose up -d --build backend`. |
| Backend build fails: `symfony/* requires php >= 8.4.1` | The Dockerfile is pinned to `php:8.4` for this reason; make sure you didn't change it back to 8.3. |
| `php artisan test` → `Test directory "tests/Unit" not found` | `phpunit.xml` no longer declares a Unit suite; make sure you're on the current code. |
| Frontend shows a blank page / API calls fail | Check `VITE_API_URL` in the `frontend` service env; the browser must be able to reach `http://localhost:8000/api`. |

---

# Part 2 — AWS

## 2.1 Architecture

```
                  ┌─────────── CloudFront (HTTPS, one *.cloudfront.net domain) ──────────┐
   Browser ─────► │  default behaviour  → S3 SPA bucket  (index.html, JS/CSS assets)     │
       │          │  /api/*  behaviour  → ALB (HTTP:80)  → EC2 :8000  (Laravel API)      │
       │          └─────────────────────────────────────────────────────────────────────┘
       │
       └── <img> ──────────────────────────► S3 media bucket (public-read GET)
                                              eventpro-media-<acct>
                                                       ▲   (PutObject/DeleteObject)
                          ┌────────────────────────────┴───────────────┐
                          │           EC2 (Docker: API container)      │──► DynamoDB
                          │   AWS SDK → EC2 instance role (least priv)  │    EventPhotoPlatform-prod
                          │       │                    │               │    (single table + GSI1)
                          └───────┼────────────────────┼───────────────┘
                                  │                    │
                     Cognito user pool          Secrets Manager
                (sign-up · email · password       eventpro/app-key
                 policy · RS256 JWTs)             eventpro/cognito-client-secret
```

- **No RDBMS** — course rule. All entities in one DynamoDB table (`PK`/`SK` + `GSI1`, on-demand).
- **Amazon Cognito** owns identity — no passwords in the app database; Cognito enforces the
  password policy, sends the verification email, and issues the tokens the API verifies.
- **No ACM** — course rule. HTTPS comes from **CloudFront's default `*.cloudfront.net` certificate**; the ALB listener stays HTTP and is only reachable from CloudFront.
- **AI pipeline (Lambda/SQS/SNS) is out of scope** — architecture-only in the report.
- The **AWS SDK on EC2 uses the instance role** — there are no access keys anywhere.

## 2.2 Cost (NZD, ~4-week project window)

| Resource | Assumption | Est. |
|---|---|---|
| EC2 t3.micro | torn down between sessions, ~120 h | $4 |
| ALB | torn down between sessions, ~60 h | $2.50 |
| DynamoDB on-demand | low thousands of ops | $0.50 |
| S3 + CloudFront | < 5 GB, mostly free tier | $0.50 |
| Secrets Manager | 2 secrets | $1 |
| Cognito | < 50k monthly users | free tier |
| CloudWatch | logs + a few alarms | free tier |
| **Total** | | **≈ $8–15** |

> **The budget killer is leaving the ALB (and EC2) running.** An ALB left up for
> 4 weeks is ~NZD 30 on its own. **Tear both down after every work session and
> after the demo** (§2.15). Set AWS Budgets alarms at $20 / $35 / $50 (§2.13).

## 2.3 Prerequisites

- AWS account with admin access for the initial setup.
- `aws` CLI v2 configured (`aws configure`) — **region `ap-southeast-2` (Sydney)**.
- The repo pushed to GitHub on a branch the EC2 box can clone
  (default in scripts: `feat/dynamodb-migration`).
- `jq` locally (used in a couple of commands).

## 2.4 Step 0 — shared shell variables

Run this once per terminal; every later command reuses it.

```bash
export AWS_REGION=ap-southeast-2
export AWS_DEFAULT_REGION=ap-southeast-2
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export TABLE=EventPhotoPlatform-prod
export MEDIA_BUCKET=eventpro-media-$ACCOUNT_ID
export SPA_BUCKET=eventpro-spa-$ACCOUNT_ID
export PROJECT=eventpro
echo "account=$ACCOUNT_ID region=$AWS_REGION"
```

## 2.5 Step 1 — DynamoDB table

You can let the app create it (it has an idempotent command), or create it with the CLI now:

```bash
aws dynamodb create-table \
  --table-name "$TABLE" \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
     AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
     AttributeName=GSI1PK,AttributeType=S AttributeName=GSI1SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes '[{
     "IndexName":"GSI1",
     "KeySchema":[{"AttributeName":"GSI1PK","KeyType":"HASH"},{"AttributeName":"GSI1SK","KeyType":"RANGE"}],
     "Projection":{"ProjectionType":"ALL"}
  }]'

aws dynamodb wait table-exists --table-name "$TABLE"

aws dynamodb update-time-to-live --table-name "$TABLE" \
  --time-to-live-specification "Enabled=true,AttributeName=ttl"
```

(Equivalent: SSH to the box later and run `php artisan dynamo:create-table`.)

## 2.6 Step 2 — S3 media bucket

Event photos, banners and thumbnails. The app serves them with `Storage::url()`
(plain URLs, not pre-signed), so the bucket is **public-read for GET**. Everything
else stays locked.

```bash
aws s3api create-bucket --bucket "$MEDIA_BUCKET" \
  --region "$AWS_REGION" --create-bucket-configuration LocationConstraint="$AWS_REGION"

aws s3api put-bucket-encryption --bucket "$MEDIA_BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Allow a public bucket policy (but not public ACLs).
aws s3api put-public-access-block --bucket "$MEDIA_BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false

aws s3api put-bucket-policy --bucket "$MEDIA_BUCKET" --policy '{
  "Version":"2012-10-17",
  "Statement":[{"Sid":"PublicReadGet","Effect":"Allow","Principal":"*",
    "Action":"s3:GetObject","Resource":"arn:aws:s3:::'"$MEDIA_BUCKET"'/*"}]
}'

aws s3api put-bucket-cors --bucket "$MEDIA_BUCKET" --cors-configuration '{
  "CORSRules":[{"AllowedOrigins":["*"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["*"],"MaxAgeSeconds":3000}]
}'
```

With this, the API leaves `AWS_URL` blank and `Storage::url()` returns
`https://<bucket>.s3.ap-southeast-2.amazonaws.com/<key>`.

> **Hardening (optional, grading-friendly):** keep the bucket fully private, add a
> CloudFront Origin Access Control + a `/media/*` behaviour, and set
> `AWS_URL=https://<dist-domain>/media` (plus an origin path so the prefix lines
> up). Skip it for the first working demo.

## 2.7 Step 3 — Amazon Cognito user pool

```bash
export POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name eventpro \
  --auto-verified-attributes email \
  --username-attributes email \
  --schema \
    Name=email,Required=true,Mutable=true \
    Name=name,Required=true,Mutable=true \
  --policies '{"PasswordPolicy":{"MinimumLength":12,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":true}}' \
  --admin-create-user-config '{"AllowAdminCreateUserOnly":false}' \
  --query 'UserPool.Id' --output text)

# App client WITH a secret; enable the admin password auth flow the API uses.
read CLIENT_ID CLIENT_SECRET < <(aws cognito-idp create-user-pool-client \
  --user-pool-id "$POOL_ID" --client-name eventpro-api \
  --generate-secret \
  --explicit-auth-flows ALLOW_ADMIN_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --query 'UserPoolClient.[ClientId,ClientSecret]' --output text)

echo "POOL_ID=$POOL_ID  CLIENT_ID=$CLIENT_ID"
```

Store the app-client secret (the API reads it at boot); `APP_KEY` too:

```bash
aws secretsmanager create-secret --name eventpro/app-key \
  --secret-string "base64:$(openssl rand -base64 32)"
aws secretsmanager create-secret --name eventpro/cognito-client-secret \
  --secret-string "$CLIENT_SECRET"
```

> The API confirms new sign-ups automatically (register → login in one step) so
> the SPA needs no "enter the code" screen. Cognito still emails a verification
> message and enforces the password policy. To switch to the real
> email-code flow, see **§2.18**.

## 2.8 Step 4 — IAM role + instance profile (least privilege)

The policy file [`infra/iam/ec2-instance-policy.json`](infra/iam/ec2-instance-policy.json)
scopes access to **exactly** this table ARN + its index, this bucket, this Cognito
pool, these two secrets, and this log group — no `*`, no managed full-access
policies (the course marks this).

```bash
cd "/Users/prantaroy/Academic Project/eventpro"

# substitute the account id and Cognito pool id placeholders
sed -e "s/ACCOUNT_ID/$ACCOUNT_ID/g" -e "s/POOL_ID/$POOL_ID/g" \
  infra/iam/ec2-instance-policy.json > /tmp/eventpro-policy.json

aws iam create-role --role-name EventPro-EC2-Role \
  --assume-role-policy-document file://infra/iam/ec2-trust-policy.json

aws iam put-role-policy --role-name EventPro-EC2-Role \
  --policy-name EventPro-EC2-Inline --policy-document file:///tmp/eventpro-policy.json

aws iam create-instance-profile --instance-profile-name EventPro-EC2-Profile
aws iam add-role-to-instance-profile \
  --instance-profile-name EventPro-EC2-Profile --role-name EventPro-EC2-Role
```

## 2.9 Step 5 — EC2 instance

### 5a. Security group

```bash
export VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)

export SG_EC2=$(aws ec2 create-security-group --group-name eventpro-ec2 \
  --description "EventPro API host" --vpc-id "$VPC_ID" --query GroupId --output text)
export SG_ALB=$(aws ec2 create-security-group --group-name eventpro-alb \
  --description "EventPro ALB" --vpc-id "$VPC_ID" --query GroupId --output text)

# ALB accepts HTTP from the internet (CloudFront hits it).
aws ec2 authorize-security-group-ingress --group-id "$SG_ALB" \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

# EC2 accepts :8000 ONLY from the ALB, and SSH from your IP.
MY_IP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress --group-id "$SG_EC2" \
  --protocol tcp --port 8000 --source-group "$SG_ALB"
aws ec2 authorize-security-group-ingress --group-id "$SG_EC2" \
  --protocol tcp --port 22 --cidr "${MY_IP}/32"
```

### 5b. Launch

```bash
export AMI=$(aws ssm get-parameter \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query 'Parameter.Value' --output text)

# EDIT infra/ec2-user-data.sh first: set REPO and BRANCH to your fork/branch.

export INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$AMI" --instance-type t3.micro \
  --iam-instance-profile Name=EventPro-EC2-Profile \
  --security-group-ids "$SG_EC2" \
  --key-name YOUR_KEYPAIR \
  --metadata-options "HttpTokens=required,HttpPutResponseHopLimit=2,HttpEndpoint=enabled" \
  --user-data file://infra/ec2-user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=eventpro-api}]' \
  --query 'Instances[0].InstanceId' --output text)

aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
export EC2_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
echo "EC2 $INSTANCE_ID @ $EC2_IP"
```

> **`HttpPutResponseHopLimit=2` is required** — Docker containers are one network
> hop from the instance, and the default IMDS hop limit of 1 blocks the AWS SDK
> inside the container from getting the instance-role credentials.

### 5c. Verify the bootstrap

Give it 3–5 minutes (swap + Docker + image build), then:

```bash
ssh -i YOUR_KEYPAIR.pem ec2-user@$EC2_IP
sudo tail -n 100 /var/log/cloud-init-output.log      # bootstrap log
sudo docker compose -f /opt/eventpro/infra/docker-compose.prod.yml ps
curl -s localhost:8000/up                            # -> 200
curl -s localhost:8000/api/events/public | head -c 200
```

If the table wasn't created yet:
```bash
sudo docker compose -f /opt/eventpro/infra/docker-compose.prod.yml exec api php artisan dynamo:create-table
```

## 2.10 Step 6 — Application Load Balancer

```bash
# Two subnets in the default VPC (ALB needs ≥ 2 AZs).
export SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC_ID \
  --query 'Subnets[?MapPublicIpOnLaunch==`true`].SubnetId' --output text)

export TG_ARN=$(aws elbv2 create-target-group --name eventpro-tg \
  --protocol HTTP --port 8000 --vpc-id "$VPC_ID" \
  --health-check-path /up --health-check-interval-seconds 15 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

aws elbv2 register-targets --target-group-arn "$TG_ARN" --targets Id="$INSTANCE_ID"

export ALB_ARN=$(aws elbv2 create-load-balancer --name eventpro-alb \
  --subnets $SUBNETS --security-groups "$SG_ALB" --type application \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

aws elbv2 wait load-balancer-available --load-balancer-arns "$ALB_ARN"

aws elbv2 create-listener --load-balancer-arn "$ALB_ARN" \
  --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn="$TG_ARN"

export ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" \
  --query 'LoadBalancers[0].DNSName' --output text)
echo "ALB: http://$ALB_DNS"
```

Wait for the target to become **healthy** (~30–60 s):

```bash
aws elbv2 describe-target-health --target-group-arn "$TG_ARN" \
  --query 'TargetHealthDescriptions[0].TargetHealth.State'
curl -s "http://$ALB_DNS/up"        # -> 200
```

## 2.11 Step 7 — CloudFront (HTTPS, one domain, no ACM)

**One distribution, two behaviours:** the SPA files are the default, and
`/api/*` proxies to the ALB. The browser only ever talks to
`https://<something>.cloudfront.net` — so there is **no CORS to configure** and
HTTPS comes free from CloudFront's own certificate. Media images are served
straight from the public S3 bucket (§2.6).

**7a. SPA bucket (private, CloudFront-only):**

```bash
aws s3api create-bucket --bucket "$SPA_BUCKET" --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"
aws s3api put-public-access-block --bucket "$SPA_BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false

export OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config '{"Name":"eventpro-spa-oac","OriginAccessControlOriginType":"s3","SigningBehavior":"always","SigningProtocol":"sigv4"}' \
  --query 'OriginAccessControl.Id' --output text)
```

**7b. Create the distribution** (CloudFront → *Create distribution* in the console
is easiest):

| Setting | Value |
|---|---|
| **Origin 1** | `$SPA_BUCKET` — S3, Origin access = *Origin access control*, select `eventpro-spa-oac` |
| **Origin 2** | `$ALB_DNS` — custom origin, **HTTP only**, port 80 |
| **Default behaviour** → Origin 1 | Viewer protocol: *Redirect HTTP to HTTPS*; Cache policy: *CachingOptimized* |
| **Behaviour `/api/*`** → Origin 2 | Cache policy: **CachingDisabled**; Origin request policy: **AllViewerExceptHostHeader**; Allowed methods: **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE** |
| **Custom error responses** | `403` → `/index.html`, 200 · `404` → `/index.html`, 200 (SPA deep-link fallback — it uses `BrowserRouter`) |
| **Default root object** | `index.html` |

**7c. Let CloudFront read the SPA bucket:**

```bash
export DIST_ID=<distribution id from 7b>
aws s3api put-bucket-policy --bucket "$SPA_BUCKET" --policy "$(cat <<EOF
{"Version":"2012-10-17","Statement":[{
  "Sid":"AllowCloudFront","Effect":"Allow",
  "Principal":{"Service":"cloudfront.amazonaws.com"},
  "Action":"s3:GetObject","Resource":"arn:aws:s3:::$SPA_BUCKET/*",
  "Condition":{"StringEquals":{"AWS:SourceArn":"arn:aws:cloudfront::$ACCOUNT_ID:distribution/$DIST_ID"}}
}]}
EOF
)"

export DIST_DOMAIN=$(aws cloudfront get-distribution --id "$DIST_ID" --query 'Distribution.DomainName' --output text)
echo "https://$DIST_DOMAIN"
```

## 2.12 Step 8 — build the SPA, point the API at the domain

**8a. Build and upload the SPA** — it calls `/api` relative to its own origin:

```bash
cd frontend
echo 'VITE_API_URL=/api' > .env.production
npm ci
npm run build                                    # -> dist/
aws s3 sync dist/ "s3://$SPA_BUCKET/" --delete
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths '/*'
```

**8b. Tell the API its public URL** — SSH to EC2 and update the env, then recreate:

```bash
ssh -i YOUR_KEYPAIR.pem ec2-user@$EC2_IP
sudo sed -i "s#^APP_URL=.*#APP_URL=https://$DIST_DOMAIN#"        /opt/eventpro/infra/.env
sudo sed -i "s#^FRONTEND_URL=.*#FRONTEND_URL=https://$DIST_DOMAIN#" /opt/eventpro/infra/.env
sudo docker compose -f /opt/eventpro/infra/docker-compose.prod.yml up -d --force-recreate
sudo docker compose -f /opt/eventpro/infra/docker-compose.prod.yml exec api php artisan dynamo:seed --fresh
```

**8c. Smoke-test:**

```bash
curl -s "https://$DIST_DOMAIN/up"                         # -> 200
curl -s "https://$DIST_DOMAIN/api/events/public/stats"    # -> JSON
open  "https://$DIST_DOMAIN"                              # the app
```

## 2.13 Step 9 — CloudWatch logs, alarms, Budgets

**Logs.** The API logs to stderr (`LOG_CHANNEL=stderr`). Ship the container logs:

```bash
# On the EC2 host, switch the compose service to the awslogs driver, or install
# the CloudWatch agent. Quick option — add to infra/docker-compose.prod.yml:
#   logging:
#     driver: awslogs
#     options:
#       awslogs-region: ap-southeast-2
#       awslogs-group: /eventpro/api
#       awslogs-create-group: "true"
```

**Alarms:**

```bash
# EC2 CPU
aws cloudwatch put-metric-alarm --alarm-name eventpro-ec2-cpu \
  --namespace AWS/EC2 --metric-name CPUUtilization --statistic Average \
  --period 300 --evaluation-periods 1 --threshold 80 --comparison-operator GreaterThanThreshold \
  --dimensions Name=InstanceId,Value=$INSTANCE_ID

# ALB 5xx
aws cloudwatch put-metric-alarm --alarm-name eventpro-alb-5xx \
  --namespace AWS/ApplicationELB --metric-name HTTPCode_Target_5XX_Count --statistic Sum \
  --period 300 --evaluation-periods 1 --threshold 5 --comparison-operator GreaterThanThreshold \
  --dimensions Name=LoadBalancer,Value=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].LoadBalancerArn' --output text | cut -d: -f6 | cut -d/ -f2-)
```

**AWS Budgets** — do this in the console (Billing → Budgets → Create budget):
a **Cost budget**, monthly limit **NZD 60**, with alerts at **$20, $35, $50**
actual spend, emailed to you. This is the safety net for the ALB-left-running risk.

## 2.14 Demo checklist

> **In Cognito mode the seeded `admin@eventpro.com` user does not exist** —
> `dynamo:seed` writes DynamoDB profiles, not Cognito identities. The seeded
> **events** still show (they're public), but you sign in with a fresh account.

1. `curl https://$DIST_DOMAIN/up` → `200`
2. Open `https://$DIST_DOMAIN` → landing page with seeded events
3. **Register** a new account → you land logged in (show the Cognito console:
   the user now exists, email marked verified, password not visible anywhere)
4. Create an event → open it → show the QR code
5. Open the public event URL in an incognito window (`/e/<slug>`)
6. Register a second account, join the event, upload a photo → it appears
7. Show the AWS console: Cognito user pool, DynamoDB table items, S3 media objects,
   CloudWatch logs, the IAM role's inline policy (least privilege), Budgets alarms
8. **Immediately after: tear down (§2.15).**

## 2.15 Teardown (do this every time you stop working)

```bash
# Stop the billable compute — keeps data, keeps setup:
aws elbv2 delete-load-balancer --load-balancer-arn "$ALB_ARN"
aws ec2 terminate-instances --instance-ids "$INSTANCE_ID"
```

To rebuild next session: re-run §2.9 (EC2) and §2.10 (ALB) — DynamoDB, S3,
secrets, IAM and CloudFront all persist. Update the CloudFront `/api/*` origin to
the new ALB DNS, and `/opt/eventpro/infra/.env` gets rewritten by user-data.

**Full teardown** (end of project):

```bash
aws elbv2 delete-load-balancer --load-balancer-arn "$ALB_ARN"
aws elbv2 delete-target-group  --target-group-arn "$TG_ARN"
aws ec2 terminate-instances --instance-ids "$INSTANCE_ID"
aws cloudfront delete-distribution --id "$DIST_ID" --if-match $(aws cloudfront get-distribution-config --id "$DIST_ID" --query ETag --output text)   # must be disabled first
aws s3 rb "s3://$SPA_BUCKET" --force
aws s3 rb "s3://$MEDIA_BUCKET" --force
aws dynamodb delete-table --table-name "$TABLE"
aws cognito-idp delete-user-pool --user-pool-id "$POOL_ID"
aws secretsmanager delete-secret --secret-id eventpro/app-key --force-delete-without-recovery
aws secretsmanager delete-secret --secret-id eventpro/cognito-client-secret --force-delete-without-recovery
aws iam remove-role-from-instance-profile --instance-profile-name EventPro-EC2-Profile --role-name EventPro-EC2-Role
aws iam delete-instance-profile --instance-profile-name EventPro-EC2-Profile
aws iam delete-role-policy --role-name EventPro-EC2-Role --policy-name EventPro-EC2-Inline
aws iam delete-role --role-name EventPro-EC2-Role
aws ec2 delete-security-group --group-id "$SG_EC2"
aws ec2 delete-security-group --group-id "$SG_ALB"
```

## 2.16 Simpler alternative — Path A (all HTTP, no CloudFront)

For the fastest possible "it runs on AWS" demo, **skip §2.11 and §2.12** and do this instead:

1. Host the SPA on the **S3 website endpoint**:
   ```bash
   aws s3api create-bucket --bucket "$SPA_BUCKET" --region "$AWS_REGION" \
     --create-bucket-configuration LocationConstraint="$AWS_REGION"
   aws s3api put-public-access-block --bucket "$SPA_BUCKET" \
     --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false
   aws s3api put-bucket-policy --bucket "$SPA_BUCKET" --policy '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::'"$SPA_BUCKET"'/*"}]}'
   aws s3 website "s3://$SPA_BUCKET" --index-document index.html --error-document index.html
   ```
2. Build with the ALB URL baked in, and upload:
   ```bash
   cd frontend
   echo "VITE_API_URL=http://$ALB_DNS/api" > .env.production
   npm ci && npm run build
   aws s3 sync dist/ "s3://$SPA_BUCKET/" --delete
   ```
3. On EC2, set `APP_URL` and `FRONTEND_URL` to the two HTTP URLs
   (`http://$ALB_DNS` and `http://$SPA_BUCKET.s3-website-$AWS_REGION.amazonaws.com`),
   then `docker compose ... up -d --force-recreate` and seed.

The media bucket from §2.6 is already public-read, so images work as-is.
Trade-off: no HTTPS, and it leans on `config/cors.php` `allowed_origins: ['*']`
(already set). Fine for a private demo; CloudFront (§2.11) is what the marking
rubric rewards.

## 2.17 Troubleshooting (AWS)

| Symptom | Cause / fix |
|---|---|
| ALB target **unhealthy** | SSH in, `curl localhost:8000/up`. If that fails, `sudo docker compose -f /opt/eventpro/infra/docker-compose.prod.yml logs api`. Check `SG_EC2` allows `:8000` from `SG_ALB`. |
| API 500s, logs show `Could not connect to ... 169.254.169.254` or `credentials` | IMDS hop limit. `aws ec2 modify-instance-metadata-options --instance-id $INSTANCE_ID --http-put-response-hop-limit 2 --http-tokens required`, then `sudo docker compose ... up -d --force-recreate`. |
| API 500s, `AccessDeniedException` on DynamoDB/S3 | The inline policy ARNs don't match. Confirm `$TABLE`, `$MEDIA_BUCKET`, `$ACCOUNT_ID`, region in `/tmp/eventpro-policy.json` and re-`put-role-policy`. |
| `dynamo:create-table` → `AccessDenied` | Add the `DynamoCreateTableOnce` statement (it's in the policy file) or create the table with the CLI (§2.5). |
| CloudFront `/api/*` returns 403 / wrong host | Origin request policy must be **AllViewerExceptHostHeader**; the ALB origin protocol must be **HTTP** (not "match viewer"). |
| SPA deep links 404 | Add the `403`/`404` → `/index.html` (200) custom error responses on the distribution. |
| Images broken in the app | Path B: check `AWS_URL` and the `/media/*` behaviour/prefix line up (§2.12 note). Path A: bucket must be public-read and `AWS_URL` blank. |
| CloudFront changes not taking effect | Distribution status must be **Deployed** (5–15 min), and `aws cloudfront create-invalidation --distribution-id $DIST_ID --paths '/*'` after an SPA re-sync. |
| Everything works but costs are climbing | You left the ALB up. `aws elbv2 delete-load-balancer ...` — it's the single most expensive idle resource. |
| Register/login 500, logs show `ResourceNotFoundException` / `User pool ... does not exist` | `COGNITO_USER_POOL_ID` / `COGNITO_REGION` in `/opt/eventpro/infra/.env` is wrong. |
| Login always 422 "These credentials do not match" even with the right password | The app client needs **`ALLOW_ADMIN_USER_PASSWORD_AUTH`** in its explicit auth flows (Step 3). |
| Register 500, logs show `NotAuthorizedException: SecretHash` | `COGNITO_CLIENT_SECRET` in `.env` doesn't match the app client, or the client has no secret. Recreate the client with `--generate-secret` and update the secret in Secrets Manager. |
| Auth works but every request is 401 after login | Token verification failing — check `COGNITO_REGION`/`COGNITO_USER_POOL_ID` match the issuer, and that the EC2 box can reach `https://cognito-idp.<region>.amazonaws.com/.../jwks.json` (needs outbound 443). |
| Want passwords back for a quick local test on EC2 | Blank `COGNITO_USER_POOL_ID` in `.env` and recreate the container — it falls back to local JWT mode. |

## 2.18 Optional — the real email-confirmation flow

By default the API auto-confirms sign-ups (`AdminConfirmSignUp` right after
`SignUp`) so register→login is one step and the SPA is unchanged. To require the
user to enter the code Cognito emails:

1. In [`app/Auth/CognitoAuthBroker.php`](backend/app/Auth/CognitoAuthBroker.php)
   `register()`, delete the `adminConfirmSignUp` + `adminUpdateUserAttributes`
   calls, and return `['user' => null, 'token' => null]` with a
   `confirmation_required` flag instead of calling `issueFor(...)`.
2. Add `POST /api/confirm` (`email` + `code`) → `confirmSignUp` → then `issueFor()`,
   and `POST /api/resend-code` → `resendConfirmationCode`.
3. Add a "check your email" screen to the SPA between register and dashboard.

The password-**reset** flow already uses the real emailed code in both modes —
only sign-up is auto-confirmed.

---

## Appendix — files in this repo

| File | Purpose |
|---|---|
| [`docker-compose.yml`](docker-compose.yml) | Local dev stack |
| [`backend/Dockerfile`](backend/Dockerfile) | API image (PHP 8.4 + `artisan serve`) |
| [`frontend/Dockerfile`](frontend/Dockerfile) | SPA image (Vite dev server) |
| [`infra/docker-compose.prod.yml`](infra/docker-compose.prod.yml) | API-only stack for EC2 |
| [`infra/ec2-user-data.sh`](infra/ec2-user-data.sh) | EC2 first-boot bootstrap |
| [`infra/redeploy.sh`](infra/redeploy.sh) | Pull + restart on the host |
| [`infra/backend.env.prod.example`](infra/backend.env.prod.example) | Production `.env` template |
| [`infra/iam/ec2-instance-policy.json`](infra/iam/ec2-instance-policy.json) | Least-privilege instance policy (DynamoDB + S3 + Cognito + Secrets) |
| [`infra/iam/ec2-trust-policy.json`](infra/iam/ec2-trust-policy.json) | EC2 assume-role trust |
| `backend/app/Console/Commands/` | `dynamo:create-table`, `dynamo:seed`, `dynamo:setup` |
| `backend/app/Auth/` | `AuthBroker` interface + `LocalAuthBroker` / `CognitoAuthBroker` |
| [`backend/app/Support/Cognito/CognitoTokenVerifier.php`](backend/app/Support/Cognito/CognitoTokenVerifier.php) | RS256 + JWKS verification of Cognito tokens |
