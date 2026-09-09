# EventPro — Deployment Guide

A step-by-step deploy of EventPro, written for someone **new to AWS**. Every step
says *what* you're making, *why*, *what it costs*, and *how to check it worked*.

---

## How to read this guide

Each step follows the same rhythm:

> **What & why** — one or two plain sentences.
> **Cost** — what it adds to the bill while it exists.
> **Do it** — the commands (copy-paste), and where the same thing lives in the web console.
> **Check it** — the exact output that means "success".
> **☐ Checkpoint** — tick it and move on.

**Golden rule for staying under budget:** almost nothing here costs money *sitting
idle* — **except the load balancer and the EC2 server**. Part 2.15 shuts those two
down in 20 seconds; run it whenever you stop working. Everything else (DynamoDB,
S3, Cognito, Lambda, CloudFront) is pay-per-use and costs cents.

---

## What you're deploying

EventPro is an event photo-sharing app:

- **Backend** — Laravel 13 REST API. **No SQL database** — all data lives in one
  Amazon DynamoDB table.
- **Frontend** — a React single-page app (SPA) that calls the API with a bearer token.
- **Auth** — Amazon Cognito (sign-up, email verification, password rules, tokens).
- **Face matching** ("find my photos by selfie") — open-source `dlib` running in
  AWS Lambda. Optional; the app works without it.

Three rules from the course shape every choice:

| Rule | What it means here |
|---|---|
| No relational database | One DynamoDB table, no RDS/MySQL/Aurora. |
| No managed AI (Rekognition, SageMaker, Bedrock) | Face matching is our own `dlib` code in a Lambda container. |
| No ACM (TLS certificates) | HTTPS comes free from CloudFront's built-in `*.cloudfront.net` certificate. |

Budget: **NZD 60 total.** Realistic spend if you shut compute down between
sessions: **NZD 8–15.**

---

# Part 0 — AWS in plain English

You'll touch ~14 AWS services. Here's each one, in the order you meet it, and what
job it does *for EventPro*. Skim now; come back when a step mentions one.

| # | Service | One-liner | EventPro's use |
|---|---|---|---|
| — | **Region** | A city where AWS runs servers. We use **`ap-southeast-2`** (Sydney) — closest to NZ. | Every resource lives in one region. Stay in Sydney the whole time. |
| — | **Availability Zone (AZ)** | Independent data centres inside a region (`...2a`, `...2b`). | The load balancer needs two; everything else needs one. |
| 1 | **IAM** (Identity & Access Management) | Who can do what. **Users** = people, **Roles** = permissions a *machine* wears, **Policies** = the rules JSON, **Instance profile** = the wrapper that hands a role to a server. | The EC2 server wears a role so it can reach DynamoDB/S3/Cognito **without any passwords stored anywhere**. |
| 2 | **DynamoDB** | A NoSQL key-value database. You define a partition key (`PK`) + sort key (`SK`); you query by key, not by SQL. Billed per request. | The single source of truth: users, events, photos metadata, face data. Table name `EventPhotoPlatform-prod`. |
| 3 | **S3** (Simple Storage Service) | Unlimited file storage. Files live in a **bucket** (globally-unique name) at a **key** (path). | One bucket for photo files; one for the built SPA. |
| 4 | **Cognito** | A managed user directory: sign-up forms, verification emails, password policy, and it mints JWT tokens. | Owns all passwords so *your* database never sees one. |
| 5 | **Secrets Manager** | An encrypted vault for API keys / secrets, fetched at runtime. | Holds the Laravel `APP_KEY` and the Cognito client secret. The server reads them on boot. |
| 6 | **EC2** (Elastic Compute Cloud) | A virtual Linux server you rent by the second. `t3.micro` = 2 vCPU / 1 GB RAM, ~free-tier. | Runs the Laravel API inside Docker. **Costs money while running — shut it down.** |
| 7 | **Security Group** | A firewall attached to a server or load balancer: "allow port X from source Y". | ALB: allow 80 from anywhere. EC2: allow 8000 *only from the ALB*, SSH only from your laptop. |
| 8 | **ALB** (Application Load Balancer) | Takes web traffic on port 80/443 and forwards it to your servers; health-checks them. A **target group** is the list of servers behind it. | The course requires a load balancer. Also gives the API a stable public address. **Costs ~$0.03/hr — shut it down.** |
| 9 | **CloudFront** | AWS's CDN: one HTTPS domain (`xxxx.cloudfront.net`), caches static files at edge locations, can also proxy `/api/*` to your ALB. | Serves the SPA over HTTPS and proxies the API — so the browser sees **one origin** and there's no CORS to fight. |
| 10 | **CloudWatch** | Logs + metrics + alarms. | Collects the API's logs; alarms on high CPU / 5xx errors. |
| 11 | **AWS Budgets** | Emails you when spend crosses a threshold. | Your safety net: alerts at $20 / $35 / $50. |
| 12 | **ECR** (Elastic Container Registry) | A private Docker image registry (like Docker Hub, but yours). | Stores the `dlib` face-recognition container image that Lambda runs. |
| 13 | **Lambda** | Run a function/container on demand, pay per 100 ms, zero cost idle. | Two functions from one image: `framefind-index` (find faces in a photo) and `framefind-search` (match a selfie). |
| 14 | **SQS** (Simple Queue Service) | A durable message queue. Producers push, consumers pull, failed messages go to a **dead-letter queue (DLQ)**. | After each photo upload the API drops a message; Lambda picks it up and indexes faces. Decouples upload speed from processing. |

**How they connect (core app):**

```
                  ┌──────── CloudFront (one HTTPS domain) ────────┐
   Browser  ────►  │  /*      → S3 bucket   (the React SPA)        │
       │           │  /api/*  → ALB → EC2:8000  (Laravel API)      │
       │           └──────────────────────────────────────────────┘
       │
       └─ <img src> ──────────────────► S3 bucket (photo files, public read)
                                                 ▲
                          ┌──────────────────────┴──────────────────┐
                          │   EC2 server, Docker: Laravel API        │─► DynamoDB
                          │   talks to AWS using an IAM ROLE         │   (one table)
                          │   (no access keys anywhere)             │
                          └───────┬─────────────────┬───────────────┘
                                  │                 │
                          Cognito user pool   Secrets Manager
                          (login + tokens)    (APP_KEY, client secret)
```

---

# Part 1 — Run it on your laptop first (Docker)

**Do this before touching AWS.** It proves the code works, and it's the same
containers you'll run on the server — so if it works here, AWS is just plumbing.

## 1.1 Install the tools

| Tool | Check it's there | Get it |
|---|---|---|
| Docker Desktop (running) | `docker version` prints a Server section | docker.com/products/docker-desktop |
| Node 22 | `node -v` → `v22.x` | nodejs.org |
| git | `git --version` | preinstalled on macOS |

> On this Mac the `docker` command isn't on your PATH. Fix it once:
> ```bash
> echo 'export PATH="$HOME/.docker/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
> ```

Free ports needed: **8000** (API), **5173** or **5174** (SPA), **8001** (DynamoDB),
**9000** (face worker).

## 1.2 What `docker compose up` starts

`docker compose` reads [`docker-compose.yml`](docker-compose.yml) **plus**
[`docker-compose.override.yml`](docker-compose.override.yml) (auto-merged). Together:

| Service | What it is | Port |
|---|---|---|
| `dynamodb` | `amazon/dynamodb-local` — DynamoDB on your laptop, in memory (wiped on stop) | 8001 |
| `migrate` | runs `php artisan dynamo:create-table` once, then exits | — |
| `backend` | the Laravel API (`php artisan serve`) | 8000 |
| `frontend` | the Vite dev server (the SPA) | **5174** (the override moves it off 5173) |
| `face-worker` | the **real** `dlib` / `face_recognition` code over HTTP, so "find my photos" works locally with **no AWS** | 9000 |
| `seed` | loads demo data on demand (`docker compose run --rm seed`) | — |

All backend settings are baked into the compose file — **no `.env` file needed** for
local Docker. The `APP_KEY` / `JWT_SECRET` in there are throwaway.

## 1.3 Start it

```bash
cd "/Users/prantaroy/Academic Project/eventpro"
docker compose up -d --build          # first run builds images — the face-worker
                                      # image is the slow one (~2-4 min)
docker compose run --rm seed          # load demo data
```

**Check it:**

| Open | Expect |
|---|---|
| http://localhost:8000/up | `200` (blank page or "OK") |
| http://localhost:8000/api/events/public | a JSON list of events |
| http://localhost:5174 | the EventPro landing page with events on it |

**Log in:** `admin@eventpro.com` / `password` (the seed also makes 6 organisers +
40 visitors, all password `password`).

☐ **Checkpoint** — the app loads, you can log in, events show.

## 1.4 Face matching, locally

With the override file present it already works — no AWS:

1. Open an event → upload a photo with a clear face. Its `processing_status` goes
   `queued` → (a few seconds) → `processed`.
2. Event page → **Find my photos** → tick the consent box → upload a selfie of the
   same face → the matching photo comes back.

If you *don't* want face matching locally: `rm docker-compose.override.yml` and
`docker compose up -d`. Uploads then just skip indexing.

## 1.5 Everyday commands

```bash
docker compose ps                                   # what's running
docker compose logs -f backend                      # tail API logs (Ctrl-C to stop)
docker compose exec backend sh                      # shell inside the API container
docker compose exec backend php artisan route:list  # list all API routes
docker compose run --rm seed                        # wipe + reload demo data
docker compose up -d --build backend                # rebuild after a backend code change
docker compose restart backend                      # after only an env change
docker compose down                                 # stop everything (data is lost)
docker compose down --rmi local -v                  # stop + delete images + volumes (full reset)
```

DynamoDB-local is in-memory, so **every `docker compose down` wipes the data** —
re-run `docker compose run --rm seed` after each `up`.

## 1.6 Run the tests

```bash
docker compose exec backend composer ci:check       # code style + static analysis + tests
# or just the tests:
docker compose exec backend php artisan test
```

## 1.7 Run it without Docker

```bash
# 1. DynamoDB-local in one container
docker run -d --name eventpro-ddb -p 8001:8000 amazon/dynamodb-local -jar DynamoDBLocal.jar -sharedDb -inMemory

# 2. Backend  (needs PHP 8.4+, Composer)
cd backend
cp .env.example .env
php artisan key:generate
php artisan storage:link        # makes uploaded photos viewable via `artisan serve`
# for laptop dev, store photos on local disk instead of S3:
sed -i '' 's/^FILESYSTEM_DISK=s3/FILESYSTEM_DISK=public/' .env
php artisan dynamo:setup --seed # create the table + demo data
php artisan serve               # http://localhost:8000

# 3. Frontend  (new terminal)
cd frontend
cp .env.example .env             # VITE_API_URL=http://localhost:8000/api
npm install && npm run dev       # http://localhost:5173
```

## 1.8 Troubleshooting (local)

| Symptom | Fix |
|---|---|
| `Bind for 0.0.0.0:8001 failed: port is already allocated` | A leftover DB container. `docker rm -f eventpro-ddb ddb-test 2>/dev/null; docker compose down --remove-orphans` then `up`. |
| `migrate` loops: `Could not resolve host: dynamodb` | Docker network got half-created (common after Docker Desktop restarts). `docker compose down --remove-orphans && docker compose up -d`. |
| Uploaded photos show as broken images | The API container missed `php artisan storage:link`. `docker compose up -d --build backend`. |
| Backend build error: `symfony/* requires php >= 8.4.1` | The Dockerfile is pinned to PHP 8.4 on purpose — don't change it to 8.3. |
| face-worker build takes forever / fails | First build downloads `dlib`. Give it 5 min. If it fails, `docker compose build face-worker` again — it's usually a transient network error. |
| "Find my photos" returns nothing | You need at least one **already-processed** photo *with a detectable face* in that event. Check `docker compose logs -f face-worker`. |

---

# Part 2 — Deploy the core app to AWS

## 2.0 The plan

Nine steps, ~60–90 minutes. Each depends on the ones before it:

```
 1  DynamoDB table ─┐
 2  S3 photo bucket ─┤
 3  Cognito pool ────┼──► 5  IAM role ──► 6  EC2 server ──► 7  ALB ──► 8  CloudFront + SPA ──► 9  Logs & alarms
 4  Secrets Manager ─┘                          ▲                                                    │
                                                └──────────  smoke test  ◄───────────────────────────┘
```

**Running cost while it's all up:** ~**NZD 0.10 / hour** (mostly the ALB + EC2).
A 2-hour work session ≈ 20 cents. **Leaving it up for a week ≈ NZD 12** — which is
why Part 2.15 exists.

## 2.1 One-time AWS account setup

Do this once, ever. Skip if your account is already set up.

1. **Turn on MFA for the root user.** Sign in as root → top-right menu → *Security
   credentials* → *Assign MFA device* → use your phone's authenticator app.
2. **Make an admin IAM user for daily work** (never use root day-to-day):
   Console → **IAM** → *Users* → *Create user* → name `you-admin` → *Attach
   policies directly* → `AdministratorAccess` → create. Then on that user →
   *Security credentials* → *Create access key* → *Command Line Interface* → copy
   the **Access key ID** and **Secret access key**.
3. **Install & configure the AWS CLI:**
   ```bash
   # macOS
   curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o AWSCLIV2.pkg && sudo installer -pkg AWSCLIV2.pkg -target /
   aws configure
   #   AWS Access Key ID     : <paste>
   #   AWS Secret Access Key : <paste>
   #   Default region name   : ap-southeast-2
   #   Default output format : json
   aws sts get-caller-identity      # should print your account id + user ARN
   ```
4. **Create an EC2 key pair** (lets you SSH into the server later):
   ```bash
   aws ec2 create-key-pair --key-name eventpro-key \
     --query 'KeyMaterial' --output text > ~/.ssh/eventpro-key.pem
   chmod 400 ~/.ssh/eventpro-key.pem
   ```

☐ **Checkpoint** — `aws sts get-caller-identity` works and shows an IAM user (not root).

## 2.2 Set a budget alarm — **do this before creating anything else**

> **What & why:** an email the moment spend crosses a line. This is what stops a
> forgotten load balancer from eating your whole budget.
> **Cost:** free.

Console → **Billing and Cost Management** → *Budgets* → *Create budget* →
*Customize (advanced)*:

- Budget type: **Cost budget**
- Period: **Monthly**, Amount: **60** (NZD, or your account currency)
- Alerts — add three, all on **Actual** spend, threshold **% of budgeted amount**:
  `33%` ($20), `58%` ($35), `83%` ($50)
- Email recipient: your email → *Create budget*

☐ **Checkpoint** — the budget shows in the list with 3 alerts.

## 2.3 Shell variables — paste once per terminal

Every later command reuses these. If you open a new terminal, paste this block again.

```bash
export AWS_REGION=ap-southeast-2
export AWS_DEFAULT_REGION=ap-southeast-2
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

export TABLE=EventPhotoPlatform-prod
export MEDIA_BUCKET=eventpro-media-$ACCOUNT_ID     # S3 bucket names must be globally unique
export SPA_BUCKET=eventpro-spa-$ACCOUNT_ID
export KEYPAIR=eventpro-key
export SSH_KEY=~/.ssh/eventpro-key.pem

echo "account $ACCOUNT_ID in $AWS_REGION"
```

## 2.4 Step 1 — DynamoDB table

> **What & why:** the app's only database. One table with a partition key (`PK`)
> and sort key (`SK`), plus one secondary index (`GSI1`) for lookups by a
> different key. `PAY_PER_REQUEST` = you pay per read/write, nothing when idle.
> **Cost:** cents for the whole project.

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

**Check it:**
```bash
aws dynamodb describe-table --table-name "$TABLE" --query 'Table.TableStatus'
# "ACTIVE"
```
**See it in the console:** DynamoDB → *Tables* → `EventPhotoPlatform-prod` → *Explore
table items* (empty for now).

> The app can also create this itself (`php artisan dynamo:create-table` on the
> server) — but doing it now means the IAM role in Step 5 doesn't need
> `CreateTable` permission.

☐ **Checkpoint** — table status `ACTIVE`.

## 2.5 Step 2 — S3 bucket for photos

> **What & why:** where uploaded photos, banners and thumbnails live. The app
> builds plain `https://bucket.s3.../key` URLs (no signing), so the bucket allows
> **public read of objects** — but nothing else.
> **Cost:** ~$0.02 per GB per month + pennies of requests.

```bash
aws s3api create-bucket --bucket "$MEDIA_BUCKET" \
  --region "$AWS_REGION" --create-bucket-configuration LocationConstraint="$AWS_REGION"

# Encrypt everything at rest (free).
aws s3api put-bucket-encryption --bucket "$MEDIA_BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Allow a *bucket policy* to grant public read (but keep public ACLs off).
aws s3api put-public-access-block --bucket "$MEDIA_BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false

# Anyone may GET an object; nobody may list or write.
aws s3api put-bucket-policy --bucket "$MEDIA_BUCKET" --policy '{
  "Version":"2012-10-17",
  "Statement":[{"Sid":"PublicReadGet","Effect":"Allow","Principal":"*",
    "Action":"s3:GetObject","Resource":"arn:aws:s3:::'"$MEDIA_BUCKET"'/*"}]
}'

# Let the browser fetch images cross-origin.
aws s3api put-bucket-cors --bucket "$MEDIA_BUCKET" --cors-configuration '{
  "CORSRules":[{"AllowedOrigins":["*"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["*"],"MaxAgeSeconds":3000}]
}'
```

**Check it:**
```bash
echo "hello" > /tmp/t.txt
aws s3 cp /tmp/t.txt "s3://$MEDIA_BUCKET/test.txt"
curl -s "https://$MEDIA_BUCKET.s3.$AWS_REGION.amazonaws.com/test.txt"   # -> hello
aws s3 rm "s3://$MEDIA_BUCKET/test.txt"
```

☐ **Checkpoint** — the `curl` prints `hello`.

## 2.6 Step 3 — Cognito user pool

> **What & why:** the user directory. It stores passwords (hashed, never visible
> to you), enforces the password policy, emails verification codes, and issues
> the JWT tokens the API checks. An **app client** is how the API talks to the
> pool; it has an ID and a secret.
> **Cost:** free up to 50,000 monthly users.

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

# App client WITH a secret. ALLOW_ADMIN_USER_PASSWORD_AUTH is the flow the API uses.
read CLIENT_ID CLIENT_SECRET < <(aws cognito-idp create-user-pool-client \
  --user-pool-id "$POOL_ID" --client-name eventpro-api \
  --generate-secret \
  --explicit-auth-flows ALLOW_ADMIN_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --query 'UserPoolClient.[ClientId,ClientSecret]' --output text)

echo "POOL_ID=$POOL_ID"
echo "CLIENT_ID=$CLIENT_ID"
```

> **Write down `POOL_ID` and `CLIENT_ID`** — you paste them into two files later
> (the EC2 startup script and, if you want, `.env` on the server).

**Check it:**
```bash
aws cognito-idp describe-user-pool --user-pool-id "$POOL_ID" --query 'UserPool.Name'  # "eventpro"
```
**See it in the console:** Cognito → *User pools* → `eventpro` → *Users* (empty).

> The API **auto-confirms** new sign-ups, so register → logged-in is one step and
> the SPA needs no "enter your code" screen. Cognito still sends the verification
> email and enforces the 12-character policy. To require the emailed code, see
> **Part 2.17**.

☐ **Checkpoint** — you have `POOL_ID`, `CLIENT_ID`, `CLIENT_SECRET`.

## 2.7 Step 4 — Secrets Manager

> **What & why:** the API needs a Laravel `APP_KEY` and the Cognito client secret.
> Storing them here (not in a file, not in the AMI) means the server fetches them
> at boot and they never sit in the repo.
> **Cost:** $0.40 per secret per month → ~$1 total.

```bash
aws secretsmanager create-secret --name eventpro/app-key \
  --secret-string "base64:$(openssl rand -base64 32)"

aws secretsmanager create-secret --name eventpro/cognito-client-secret \
  --secret-string "$CLIENT_SECRET"
```

**Check it:**
```bash
aws secretsmanager get-secret-value --secret-id eventpro/app-key --query 'Name' --output text  # eventpro/app-key
```

☐ **Checkpoint** — both secrets listed by `aws secretsmanager list-secrets`.

## 2.8 Step 5 — IAM role for the server

> **What & why:** the EC2 server must read DynamoDB, read/write the photo bucket,
> call Cognito, and read the two secrets — **with no passwords**. The way that
> works: the server *wears a role*, and the role has a policy listing exactly
> those actions on exactly those resources. The **instance profile** is the
> plug that attaches the role to the server.
> The policy file — [`infra/iam/ec2-instance-policy.json`](infra/iam/ec2-instance-policy.json)
> — has **no `*` and no AWS-managed "FullAccess" policies**. Graders check this.
> **Cost:** free.

```bash
cd "/Users/prantaroy/Academic Project/eventpro"

# The file has ACCOUNT_ID and POOL_ID placeholders — fill them in.
sed -e "s/ACCOUNT_ID/$ACCOUNT_ID/g" -e "s/POOL_ID/$POOL_ID/g" \
  infra/iam/ec2-instance-policy.json > /tmp/eventpro-ec2-policy.json

aws iam create-role --role-name EventPro-EC2-Role \
  --assume-role-policy-document file://infra/iam/ec2-trust-policy.json

aws iam put-role-policy --role-name EventPro-EC2-Role \
  --policy-name EventPro-EC2-Inline --policy-document file:///tmp/eventpro-ec2-policy.json

aws iam create-instance-profile --instance-profile-name EventPro-EC2-Profile
aws iam add-role-to-instance-profile \
  --instance-profile-name EventPro-EC2-Profile --role-name EventPro-EC2-Role
```

**Check it:**
```bash
aws iam get-role-policy --role-name EventPro-EC2-Role --policy-name EventPro-EC2-Inline \
  --query 'PolicyDocument.Statement[].Sid'
# ["DynamoSingleTable","DynamoCreateTableOnce","MediaBucketObjects","MediaBucketList","Cognito","Secrets","CloudWatchLogs","FaceIndexEnqueue","FaceSearchInvoke"]
```
**See it in the console:** IAM → *Roles* → `EventPro-EC2-Role` → *Permissions* — read
the JSON; every line names one table / bucket / pool ARN.

☐ **Checkpoint** — the role exists and its policy lists those Sids.

## 2.9 Step 6 — the EC2 server

This is three parts: a firewall, the startup script, then the server itself.

### 6a — Firewall (security groups)

> **What & why:** two firewalls. `SG_ALB` lets the internet reach the load
> balancer on port 80. `SG_EC2` lets **only the load balancer** reach the server
> on 8000, and only **your laptop** SSH in on 22.
> **Cost:** free.

```bash
export VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' --output text)

export SG_ALB=$(aws ec2 create-security-group --group-name eventpro-alb \
  --description "EventPro load balancer" --vpc-id "$VPC_ID" --query GroupId --output text)
export SG_EC2=$(aws ec2 create-security-group --group-name eventpro-ec2 \
  --description "EventPro API server" --vpc-id "$VPC_ID" --query GroupId --output text)

# Internet -> ALB on 80
aws ec2 authorize-security-group-ingress --group-id "$SG_ALB" \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

# ALB -> EC2 on 8000  (source is the ALB's security group, not an IP)
aws ec2 authorize-security-group-ingress --group-id "$SG_EC2" \
  --protocol tcp --port 8000 --source-group "$SG_ALB"

# Your laptop -> EC2 on 22 (SSH)
MY_IP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress --group-id "$SG_EC2" \
  --protocol tcp --port 22 --cidr "${MY_IP}/32"

echo "SG_ALB=$SG_ALB  SG_EC2=$SG_EC2  VPC=$VPC_ID"
```

### 6b — Edit the startup script

Open [`infra/ec2-user-data.sh`](infra/ec2-user-data.sh). This runs **once** when
the server first boots: installs Docker, clones the repo, writes `.env` (pulling
secrets from Secrets Manager), and starts the API container.

Near the top of the file are three placeholder lines:

```bash
COGNITO_USER_POOL_ID=ap-southeast-2_xxxxxxxxx     # <- your POOL_ID
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx      # <- your CLIENT_ID
PUBLIC_URL=https://xxxxxxxxxxxxxx.cloudfront.net  # leave as-is; Step 8 sets the real URL
```

Fill the first two in (leave `PUBLIC_URL` — Step 8e overwrites it on the server).
Also check `REPO=` points at your GitHub fork and `BRANCH=main`.

```bash
sed -i '' "s|^COGNITO_USER_POOL_ID=.*|COGNITO_USER_POOL_ID=$POOL_ID|" infra/ec2-user-data.sh
sed -i '' "s|^COGNITO_CLIENT_ID=.*|COGNITO_CLIENT_ID=$CLIENT_ID|" infra/ec2-user-data.sh
git add infra/ec2-user-data.sh && git commit -m "wire cognito ids" && git push
```

> The server does a fresh `git clone` on boot, so **your changes must be pushed to
> GitHub** before you launch it.

### 6c — Launch the server

> **Cost:** `t3.micro` ≈ **NZD 0.02/hour** (or free if your account still has
> free-tier hours). **This is now costing money — Part 2.15 stops it.**

```bash
export AMI=$(aws ssm get-parameter \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query 'Parameter.Value' --output text)

export INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$AMI" --instance-type t3.micro \
  --iam-instance-profile Name=EventPro-EC2-Profile \
  --security-group-ids "$SG_EC2" \
  --key-name "$KEYPAIR" \
  --metadata-options "HttpTokens=required,HttpPutResponseHopLimit=2,HttpEndpoint=enabled" \
  --user-data file://infra/ec2-user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=eventpro-api}]' \
  --query 'Instances[0].InstanceId' --output text)

aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
export EC2_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
echo "server $INSTANCE_ID at $EC2_IP — give it 4-5 minutes to build"
```

> **`HttpPutResponseHopLimit=2` matters.** The API runs in Docker, which is one
> network hop from the server. AWS's default limit of 1 hop blocks the container
> from reading the server's IAM credentials — and every AWS call 500s. Two hops
> fixes it.

### 6d — Check the boot

Wait ~5 minutes (it's compiling PHP extensions + building the image), then:

```bash
ssh -i "$SSH_KEY" ec2-user@$EC2_IP

# on the server:
sudo tail -n 40 /var/log/cloud-init-output.log        # the startup script's log
sudo docker compose -f /opt/eventpro/infra/docker-compose.prod.yml ps   # api should be "Up"
curl -s localhost:8000/up                             # -> 200
curl -s localhost:8000/api/events/public              # -> [] (empty, no seed yet)
exit
```

If the table wasn't created in Step 1, do it now:
```bash
ssh -i "$SSH_KEY" ec2-user@$EC2_IP \
  'sudo docker compose -f /opt/eventpro/infra/docker-compose.prod.yml exec -T api php artisan dynamo:create-table'
```

☐ **Checkpoint** — `curl localhost:8000/up` on the server returns `200`.

## 2.10 Step 7 — the load balancer (ALB)

> **What & why:** the course requires a load balancer. It also gives the API a
> permanent public address and health-checks the server (`GET /up`). A **target
> group** is the list of servers it forwards to.
> **Cost:** ~**NZD 0.03/hour** + tiny data charges. **The single most expensive
> idle thing you'll create — Part 2.15 deletes it.**

```bash
# The ALB needs two subnets in different AZs. The default VPC has one per AZ.
export SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC_ID \
  --query 'Subnets[?MapPublicIpOnLaunch==`true`].SubnetId' --output text)

# Target group: "servers on port 8000, healthy if GET /up returns 200"
export TG_ARN=$(aws elbv2 create-target-group --name eventpro-tg \
  --protocol HTTP --port 8000 --vpc-id "$VPC_ID" \
  --health-check-path /up --health-check-interval-seconds 15 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

aws elbv2 register-targets --target-group-arn "$TG_ARN" --targets Id="$INSTANCE_ID"

# The load balancer itself
export ALB_ARN=$(aws elbv2 create-load-balancer --name eventpro-alb \
  --subnets $SUBNETS --security-groups "$SG_ALB" --type application \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)
aws elbv2 wait load-balancer-available --load-balancer-arns "$ALB_ARN"

# Listener: "traffic on port 80 -> the target group"
aws elbv2 create-listener --load-balancer-arn "$ALB_ARN" \
  --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn="$TG_ARN"

export ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" \
  --query 'LoadBalancers[0].DNSName' --output text)
echo "ALB at http://$ALB_DNS"
```

**Check it** (wait ~60 s for the health check to pass):
```bash
aws elbv2 describe-target-health --target-group-arn "$TG_ARN" \
  --query 'TargetHealthDescriptions[0].TargetHealth.State'         # "healthy"
curl -s "http://$ALB_DNS/up"                                       # 200
curl -s "http://$ALB_DNS/api/events/public"                        # []
```

If it stays `unhealthy`: SSH in and `curl localhost:8000/up` — if that works, the
`SG_EC2` rule allowing 8000 from `SG_ALB` is missing or wrong.

☐ **Checkpoint** — target `healthy`, `http://$ALB_DNS/up` returns `200`.

## 2.11 Step 8 — CloudFront + the SPA

> **What & why:** one HTTPS address for everything. CloudFront serves the React
> app from an S3 bucket **and** proxies `/api/*` to the ALB. Because the browser
> only ever talks to `xxxx.cloudfront.net`, there's **no CORS** and you get HTTPS
> free (no ACM needed — a course rule).
> **Cost:** free tier covers a demo (1 TB out, 10M requests/month).
>
> **In a hurry?** Skip this whole step and use **Part 2.16** (plain HTTP, ~10 min).
> Come back and do CloudFront for the real submission.

### 8a — Bucket for the built SPA

```bash
aws s3api create-bucket --bucket "$SPA_BUCKET" --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"
aws s3api put-public-access-block --bucket "$SPA_BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false

# "Origin Access Control" = only CloudFront may read this bucket, nobody else.
export OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config '{"Name":"eventpro-spa-oac","OriginAccessControlOriginType":"s3","SigningBehavior":"always","SigningProtocol":"sigv4"}' \
  --query 'OriginAccessControl.Id' --output text)
```

### 8b — Create the distribution (use the console — it's clearer than the CLI here)

Console → **CloudFront** → *Create distribution*:

| Field | Value |
|---|---|
| **Origin domain** (origin 1) | pick `$SPA_BUCKET` from the S3 list |
| Origin access | *Origin access control settings* → select `eventpro-spa-oac` (a yellow banner appears about the bucket policy — you'll fix it in 8c) |
| **Add another origin** (origin 2) | type the **ALB DNS name** (`eventpro-alb-….elb.amazonaws.com`); Protocol: **HTTP only**, port 80 |
| Default cache behavior → Origin | origin 1 (the SPA bucket) |
| Viewer protocol policy | **Redirect HTTP to HTTPS** |
| Cache policy | **CachingOptimized** |
| **Default root object** | `index.html` |

Then *Create*. Open the distribution → **Behaviors** → *Create behavior*:

| Field | Value |
|---|---|
| Path pattern | `/api/*` |
| Origin | origin 2 (the ALB) |
| Viewer protocol policy | Redirect HTTP to HTTPS |
| Allowed HTTP methods | **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE** |
| Cache policy | **CachingDisabled** |
| Origin request policy | **AllViewerExceptHostHeader** |

Then → **Error pages** → *Create custom error response* (do this **twice**):

| HTTP error code | Customize response | Response page path | HTTP response code |
|---|---|---|---|
| `403` | Yes | `/index.html` | `200` |
| `404` | Yes | `/index.html` | `200` |

(That last bit makes deep links like `/dashboard/events` load the SPA instead of 404ing.)

### 8c — Let CloudFront read the SPA bucket

```bash
export DIST_ID=<the distribution ID from the CloudFront list, like E1ABCD2EF3GHIJ>

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
echo "your app will be at  https://$DIST_DOMAIN"
```

### 8d — Build & upload the SPA

The SPA calls `/api` relative to its own domain — so it works no matter what the
CloudFront domain is.

```bash
cd frontend
echo 'VITE_API_URL=/api' > .env.production
npm ci
npm run build                                       # -> frontend/dist/
aws s3 sync dist/ "s3://$SPA_BUCKET/" --delete
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths '/*'
cd ..
```

### 8e — Tell the API its public URL

The API builds absolute links (QR codes, password-reset links) from `APP_URL` /
`FRONTEND_URL`. Point them at the CloudFront domain:

```bash
ssh -i "$SSH_KEY" ec2-user@$EC2_IP
sudo sed -i "s#^APP_URL=.*#APP_URL=https://$DIST_DOMAIN#"        /opt/eventpro/infra/.env
sudo sed -i "s#^FRONTEND_URL=.*#FRONTEND_URL=https://$DIST_DOMAIN#" /opt/eventpro/infra/.env
sudo docker compose -f /opt/eventpro/infra/docker-compose.prod.yml up -d --force-recreate
# optional demo data:
sudo docker compose -f /opt/eventpro/infra/docker-compose.prod.yml exec -T api php artisan dynamo:seed --fresh
exit
```

**Check it** (CloudFront takes 5–15 min to finish deploying the first time):
```bash
curl -s "https://$DIST_DOMAIN/up"                          # 200
curl -s "https://$DIST_DOMAIN/api/events/public/stats"     # JSON
open  "https://$DIST_DOMAIN"                               # the app, over HTTPS
```

☐ **Checkpoint** — the app opens at `https://$DIST_DOMAIN` and you can register + log in.

## 2.12 Step 9 — logs & alarms

> **What & why:** so you can see errors and get warned about runaway cost / a
> broken server.
> **Cost:** free tier.

**Ship the API logs to CloudWatch.** Edit
[`infra/docker-compose.prod.yml`](infra/docker-compose.prod.yml), add to the `api`
service:

```yaml
    logging:
      driver: awslogs
      options:
        awslogs-region: ap-southeast-2
        awslogs-group: /eventpro/api
        awslogs-create-group: "true"
```

Commit, push, then on the server: `sudo bash /opt/eventpro/infra/redeploy.sh`.

**Alarms:**

```bash
aws cloudwatch put-metric-alarm --alarm-name eventpro-ec2-cpu \
  --namespace AWS/EC2 --metric-name CPUUtilization --statistic Average \
  --period 300 --evaluation-periods 1 --threshold 85 --comparison-operator GreaterThanThreshold \
  --dimensions Name=InstanceId,Value=$INSTANCE_ID

aws cloudwatch put-metric-alarm --alarm-name eventpro-alb-5xx \
  --namespace AWS/ApplicationELB --metric-name HTTPCode_Target_5XX_Count --statistic Sum \
  --period 300 --evaluation-periods 1 --threshold 5 --comparison-operator GreaterThanThreshold \
  --dimensions Name=LoadBalancer,Value=$(echo $ALB_ARN | cut -d: -f6 | cut -d/ -f2-)
```

**See it in the console:** CloudWatch → *Log groups* → `/eventpro/api` (live API
logs); *Alarms* (both, state `OK`).

☐ **Checkpoint** — `/eventpro/api` log group has entries; two alarms exist.

## 2.13 Full smoke test

```bash
curl -s "https://$DIST_DOMAIN/up"                                  # 200
curl -s "https://$DIST_DOMAIN/api/events/public" | head -c 200     # JSON
```
In the browser at `https://$DIST_DOMAIN`:
1. Register a new account → you land logged in.
2. Create an event → open it → the QR code renders.
3. Copy the public link (`/e/<slug>`), open it in a private window → the event shows.
4. Register a second account in another browser, join the event, upload a photo →
   it appears for both users.

☐ **Checkpoint** — all four work.

## 2.14 Demo-day checklist

> The seeded `admin@eventpro.com` **does not exist in Cognito** (seeding writes
> DynamoDB, not the user pool). Seeded *events* still show; sign in with a fresh
> account you register live.

1. `curl https://$DIST_DOMAIN/up` → `200`.
2. Open the app → seeded events on the landing page.
3. **Register live** → show the Cognito console: the user appears, email marked
   verified, **no password anywhere**.
4. Create an event → QR code.
5. Open the public `/e/<slug>` link in incognito.
6. Second account → join → upload a photo → appears.
7. Console tour: Cognito users, DynamoDB items, S3 objects, CloudWatch logs, the
   IAM role JSON (point at the lack of `*`), the Budgets page.
8. *(if Part 3 is deployed)* upload a face photo → wait a minute → "Find my
   photos" with a selfie → matches.
9. **Right after: run Part 2.15.**

## 2.15 Shut it down (every time you stop working)

> Deletes only the two things that cost money idle. **Keeps** DynamoDB, S3,
> Cognito, Secrets, IAM, CloudFront — so rebuilding next time is quick.

```bash
aws elbv2 delete-load-balancer --load-balancer-arn "$ALB_ARN"
aws ec2 terminate-instances --instance-ids "$INSTANCE_ID"
echo "compute stopped. DynamoDB / S3 / Cognito / CloudFront still there."
```

**Next session, to bring it back:** redo **Step 6c** (launch EC2) and **Step 7**
(ALB) — ~5 minutes. The startup script rebuilds `.env` from Secrets Manager
automatically. Then update the CloudFront `/api/*` behaviour's origin to the new
ALB DNS (CloudFront → distribution → *Origins* → edit origin 2 → new DNS →
*Save*), and re-run **Step 8e** to set `APP_URL`/`FRONTEND_URL` again if they were
seeded fresh.

**Check nothing pricey is still running:**
```bash
aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerName'   # []
aws ec2 describe-instances --filters Name=instance-state-name,Values=running \
  --query 'Reservations[].Instances[].InstanceId'                             # []
```

## 2.16 Shortcut — plain HTTP, no CloudFront (~10 min)

For a fast "it runs on AWS" checkpoint. **Do Steps 1–7 and 9 as normal; replace
Step 8 with this.** Upgrade to CloudFront later for the submission.

```bash
# SPA on the S3 website endpoint (public)
aws s3api create-bucket --bucket "$SPA_BUCKET" --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"
aws s3api put-public-access-block --bucket "$SPA_BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false
aws s3api put-bucket-policy --bucket "$SPA_BUCKET" --policy '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::'"$SPA_BUCKET"'/*"}]}'
aws s3 website "s3://$SPA_BUCKET" --index-document index.html --error-document index.html

export SPA_URL="http://$SPA_BUCKET.s3-website-$AWS_REGION.amazonaws.com"

# build the SPA pointed straight at the ALB
cd frontend
echo "VITE_API_URL=http://$ALB_DNS/api" > .env.production
npm ci && npm run build
aws s3 sync dist/ "s3://$SPA_BUCKET/" --delete
cd ..

# point the API at the HTTP URLs
ssh -i "$SSH_KEY" ec2-user@$EC2_IP \
  "sudo sed -i 's#^APP_URL=.*#APP_URL=http://$ALB_DNS#; s#^FRONTEND_URL=.*#FRONTEND_URL=$SPA_URL#' /opt/eventpro/infra/.env && \
   sudo docker compose -f /opt/eventpro/infra/docker-compose.prod.yml up -d --force-recreate"

echo "app at  $SPA_URL"
```

Trade-off: no HTTPS. It relies on the API's CORS being open (`allowed_origins:
['*']`, already set). Fine for a private demo; CloudFront is what the marking
rubric rewards.

## 2.17 Optional — require the emailed confirmation code

By default the API auto-confirms sign-ups (register → logged in, one step). To
make users enter the code Cognito emails:

1. In [`backend/app/Auth/CognitoAuthBroker.php`](backend/app/Auth/CognitoAuthBroker.php)
   `register()`, delete the `adminConfirmSignUp` + `adminUpdateUserAttributes`
   calls; return a `confirmation_required` flag instead of calling `issueFor()`.
2. Add `POST /api/confirm` (`email` + `code` → `confirmSignUp` → `issueFor`) and
   `POST /api/resend-code` (`resendConfirmationCode`).
3. Add a "check your email" screen to the SPA between register and dashboard.

Password **reset** already uses the real emailed code in both modes.

---

# Part 3 — Face-recognition pipeline (optional)

"Find my photos by selfie", using open-source `dlib` (no Rekognition — course rule).
The app runs fine without this; uploads just skip face indexing and the selfie
search returns `unavailable`.

## 3.0 How it works

**One container image, two Lambda functions:**

| Function | Triggered by | Job | DynamoDB |
|---|---|---|---|
| `framefind-index` | a message on the **SQS queue** (the API pushes one after every photo upload) | download the photo from S3, detect + encode every face, write a `FACE#<photoId>#<n>` row per face, flip the photo's `processing_status` | **writes** |
| `framefind-search` | a **direct call** from the API when someone searches | download the selfie, **delete it immediately**, encode its face, compare against every `FACE#` row for that event, return matching photo IDs | **reads only** (Query) |

```
 upload ──► API stores photo in S3, writes PHOTO# row (status=queued)
        └─► API sends SQS message {event_id, photo_id, bucket, key}
                     │
        SQS FaceIndexQueue ──(batch size 1)──► framefind-index Lambda
                     │  (3 failures) ──► FaceIndexDLQ
                     └─► writes FACE# rows, sets status=processed / no_faces

 "Find my photos" ──► API (consent check) ──► saves selfie to S3 tmp/
                  └─► calls framefind-search Lambda directly
                          └─► reads selfie, deletes it, Query FACE# rows,
                              returns {matchedPhotoIds, distances}
                  └─► API saves matches as MATCH# rows, returns the photos
```

**Consent:** captured on the user's *first* selfie search — the request must carry
`consent=true` or the API returns **403 before storing anything or calling Lambda**.
Stored on the member row (`consent_facial_matching` + timestamp). Withdrawing it
(`DELETE /api/events/{event}/photo-search/consent`) deletes the person's match rows.
The selfie itself is **never kept** — deleted by the Lambda, again by the API, and
an S3 lifecycle rule expires anything left after 1 day.

> Every command below makes a billable resource. Total added cost ≈ **< NZD 2**.
> Reuses the Part 2 variables (`$ACCOUNT_ID`, `$AWS_REGION`, `$TABLE`, `$MEDIA_BUCKET`).

```bash
export FACE_ECR=framefind-faces
export IDX_FN=framefind-index
export SEARCH_FN=framefind-search
export IDX_QUEUE=FaceIndexQueue
export IDX_DLQ=FaceIndexDLQ
```

## 3.1 Build & push the container image (ECR)

> **What & why:** Lambda can run a Docker image, but only from *your* ECR
> registry. So: make a repo, log Docker into it, build, push.
> **Cost:** ~$0.15/month for the ~1.5 GB image.

```bash
aws ecr create-repository --repository-name "$FACE_ECR" \
  --image-scanning-configuration scanOnPush=true

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

cd lambda/face-recognition
# Uses a prebuilt dlib wheel — builds in ~1 min, not the classic 15.
docker build --platform linux/amd64 --target lambda -t "$FACE_ECR" .
docker tag "$FACE_ECR:latest" "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$FACE_ECR:latest"
docker push "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$FACE_ECR:latest"
cd ../..
```

**Check it:**
```bash
aws ecr describe-images --repository-name "$FACE_ECR" --query 'imageDetails[0].imageTags'  # ["latest"]
```

## 3.2 SQS queue + dead-letter queue

> **What & why:** the queue holds "index this photo" jobs so the API doesn't wait
> for `dlib`. A message that fails 3 times moves to the DLQ instead of retrying
> forever.
> **Cost:** free tier (1M requests/month).

```bash
DLQ_URL=$(aws sqs create-queue --queue-name "$IDX_DLQ" --query QueueUrl --output text)
DLQ_ARN=$(aws sqs get-queue-attributes --queue-url "$DLQ_URL" \
  --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

# VisibilityTimeout must be >= 6x the Lambda timeout (120s) -> 780s.
IDX_URL=$(aws sqs create-queue --queue-name "$IDX_QUEUE" --attributes '{
  "VisibilityTimeout":"780",
  "RedrivePolicy":"{\"deadLetterTargetArn\":\"'"$DLQ_ARN"'\",\"maxReceiveCount\":\"3\"}"
}' --query QueueUrl --output text)
IDX_ARN=$(aws sqs get-queue-attributes --queue-url "$IDX_URL" \
  --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

echo "FACE_INDEX_QUEUE_URL=$IDX_URL"
```

## 3.3 IAM roles for the two Lambdas

> **What & why:** each Lambda gets its **own** minimal role. The indexer can read
> photos + write faces + consume the queue. The searcher can **only** read/delete
> selfies and **Query** DynamoDB — it can't write. Policy files:
> [`lambda-faceindex-policy.json`](infra/iam/lambda-faceindex-policy.json),
> [`lambda-facesearch-policy.json`](infra/iam/lambda-facesearch-policy.json).
> **Cost:** free.

```bash
for pair in "EventPro-FaceIndex-Role:lambda-faceindex-policy" \
            "EventPro-FaceSearch-Role:lambda-facesearch-policy"; do
  ROLE="${pair%%:*}"; FILE="${pair##*:}"
  sed "s/ACCOUNT_ID/$ACCOUNT_ID/g" "infra/iam/$FILE.json" > "/tmp/$FILE.json"
  aws iam create-role --role-name "$ROLE" \
    --assume-role-policy-document file://infra/iam/lambda-trust-policy.json
  aws iam put-role-policy --role-name "$ROLE" \
    --policy-name "${ROLE}-Inline" --policy-document "file:///tmp/$FILE.json"
done
```

## 3.4 Create the two Lambda functions

> One image, two functions — the `Command` picks which handler runs.
> **Cost:** ~$1 for the whole project (~2,000 index + ~300 search runs).

```bash
IMAGE="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$FACE_ECR:latest"

# Index: dlib is CPU-bound, and Lambda gives more CPU with more memory, so
# 2048 MB actually finishes FASTER and CHEAPER than 512 MB. reserved-concurrent
# 5 is a free cap (NOT provisioned concurrency, which bills hourly).
aws lambda create-function --function-name "$IDX_FN" \
  --package-type Image --code ImageUri="$IMAGE" \
  --image-config '{"Command":["face_index_handler.handler"]}' \
  --role "arn:aws:iam::$ACCOUNT_ID:role/EventPro-FaceIndex-Role" \
  --timeout 120 --memory-size 2048 --reserved-concurrent-executions 5 \
  --environment "Variables={TABLE_NAME=$TABLE,FACE_MATCH_MODEL=hog}"

aws lambda create-function --function-name "$SEARCH_FN" \
  --package-type Image --code ImageUri="$IMAGE" \
  --image-config '{"Command":["face_search_handler.handler"]}' \
  --role "arn:aws:iam::$ACCOUNT_ID:role/EventPro-FaceSearch-Role" \
  --timeout 60 --memory-size 2048 \
  --environment "Variables={TABLE_NAME=$TABLE,FACE_MATCH_THRESHOLD=0.55}"

aws lambda wait function-active-v2 --function-name "$IDX_FN"
aws lambda wait function-active-v2 --function-name "$SEARCH_FN"
```

## 3.5 Connect the queue to the indexer

```bash
aws lambda create-event-source-mapping \
  --function-name "$IDX_FN" --event-source-arn "$IDX_ARN" --batch-size 1
```

> No S3-event trigger — the API sends the SQS message itself, with the photo's
> exact DynamoDB sort key, so the Lambda never has to parse S3 paths.

## 3.6 S3 lifecycle — expire stray selfies

```bash
aws s3api put-bucket-lifecycle-configuration --bucket "$MEDIA_BUCKET" \
  --lifecycle-configuration '{"Rules":[{
    "ID":"expire-tmp-selfies","Status":"Enabled",
    "Filter":{"Prefix":"tmp/"},"Expiration":{"Days":1}
  }]}'
```

## 3.7 Re-apply the EC2 policy (SQS send + Lambda invoke)

[`infra/iam/ec2-instance-policy.json`](infra/iam/ec2-instance-policy.json) already
contains the `FaceIndexEnqueue` (`sqs:SendMessage`) and `FaceSearchInvoke`
(`lambda:InvokeFunction`) statements. Re-push it:

```bash
sed -e "s/ACCOUNT_ID/$ACCOUNT_ID/g" -e "s/POOL_ID/$POOL_ID/g" \
  infra/iam/ec2-instance-policy.json > /tmp/eventpro-ec2-policy.json
aws iam put-role-policy --role-name EventPro-EC2-Role \
  --policy-name EventPro-EC2-Inline --policy-document file:///tmp/eventpro-ec2-policy.json
```

## 3.8 Turn it on in the API

```bash
ssh -i "$SSH_KEY" ec2-user@$EC2_IP
sudo tee -a /opt/eventpro/infra/.env >/dev/null <<EOF
FACE_SEARCH_LAMBDA_NAME=framefind-search
FACE_INDEX_QUEUE_URL=$IDX_URL
FACE_MATCH_THRESHOLD=0.55
EOF
sudo docker compose -f /opt/eventpro/infra/docker-compose.prod.yml up -d --force-recreate
exit
```

## 3.9 Verify end to end

```bash
# 1. Upload a photo with a face to an event, then watch the queue drain:
aws sqs get-queue-attributes --queue-url "$IDX_URL" \
  --attribute-names ApproximateNumberOfMessages     # goes 1 -> 0 within ~1 min

# 2. Check the indexer ran:
aws logs tail /aws/lambda/framefind-index --since 5m

# 3. In DynamoDB, the photo's row now has processing_status=processed and
#    FACE#<photoId>#0 rows exist under PK=EVENT#<id>.
```

Then in the app: event page → **Find my photos** → tick consent → upload a selfie
of the same face → matches render. `GET /api/events/{id}/photo-search/mine`
returns them with no new Lambda call.

☐ **Checkpoint** — queue drains, `FACE#` rows appear, selfie search returns matches.

## 3.10 Shut down the face pipeline

```bash
aws lambda delete-event-source-mapping --uuid $(aws lambda list-event-source-mappings \
  --function-name "$IDX_FN" --query 'EventSourceMappings[0].UUID' --output text)
aws lambda delete-function --function-name "$IDX_FN"
aws lambda delete-function --function-name "$SEARCH_FN"
aws sqs delete-queue --queue-url "$IDX_URL"
aws sqs delete-queue --queue-url "$DLQ_URL"
aws ecr delete-repository --repository-name "$FACE_ECR" --force
for ROLE in EventPro-FaceIndex-Role EventPro-FaceSearch-Role; do
  aws iam delete-role-policy --role-name "$ROLE" --policy-name "${ROLE}-Inline"
  aws iam delete-role --role-name "$ROLE"
done
aws s3api delete-bucket-lifecycle --bucket "$MEDIA_BUCKET"
```

Lambda + SQS cost nothing idle, so you can leave them and just delete them at the
end with the rest (Part 5). ECR's $0.15/month is the only standing charge.

## 3.11 Cost & watch-outs

| Item | Assumption | Est. |
|---|---|---|
| Lambda | ~2,000 index @ 2 GB/~8 s + ~300 search @ 2 GB/~3 s | ~$1.00 |
| ECR | one ~1.5 GB image | ~$0.15/mo |
| DynamoDB `FACE#` / `MATCH#` rows | on-demand, ~1 KB each | cents |
| SQS + DLQ, CloudWatch Logs, S3 selfies | low volume, auto-expire | free tier |
| **Added total** | | **≈ < $2** |

- **Never turn on provisioned concurrency** — it bills per hour, idle or not.
  `--reserved-concurrent-executions 5` is a free upper limit, not reserved capacity.
- **2048 MB is deliberate** — don't lower it "to save money"; it's slower *and*
  costlier at 512 MB because `dlib` is CPU-bound.
- The real budget risk is still the **ALB/EC2 left running** — this pipeline
  doesn't change that.

---

# Part 4 — Redeploying after a code change

You changed backend code and pushed to `main`. On the server:

```bash
ssh -i "$SSH_KEY" ec2-user@$EC2_IP 'sudo bash /opt/eventpro/infra/redeploy.sh'
```

That pulls `main`, rebuilds the container, re-caches config, re-checks the table.

Frontend change:

```bash
cd frontend && npm run build && aws s3 sync dist/ "s3://$SPA_BUCKET/" --delete && cd ..
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths '/*'
```

---

# Part 5 — Full teardown (end of project)

```bash
# compute (also in Part 2.15)
aws elbv2 delete-load-balancer --load-balancer-arn "$ALB_ARN" 2>/dev/null
aws elbv2 delete-target-group  --target-group-arn "$TG_ARN" 2>/dev/null
aws ec2 terminate-instances --instance-ids "$INSTANCE_ID" 2>/dev/null

# face pipeline (Part 3.10) if you skipped it

# CloudFront — must be disabled first, then wait, then delete (or just do it in the console)
aws cloudfront get-distribution-config --id "$DIST_ID" --query ETag --output text
# ... set Enabled:false via update-distribution, wait ~15 min, then:
aws cloudfront delete-distribution --id "$DIST_ID" --if-match <new ETag>

# storage & data
aws s3 rb "s3://$SPA_BUCKET" --force
aws s3 rb "s3://$MEDIA_BUCKET" --force
aws dynamodb delete-table --table-name "$TABLE"

# identity & secrets
aws cognito-idp delete-user-pool --user-pool-id "$POOL_ID"
aws secretsmanager delete-secret --secret-id eventpro/app-key --force-delete-without-recovery
aws secretsmanager delete-secret --secret-id eventpro/cognito-client-secret --force-delete-without-recovery

# IAM
aws iam remove-role-from-instance-profile --instance-profile-name EventPro-EC2-Profile --role-name EventPro-EC2-Role
aws iam delete-instance-profile --instance-profile-name EventPro-EC2-Profile
aws iam delete-role-policy --role-name EventPro-EC2-Role --policy-name EventPro-EC2-Inline
aws iam delete-role --role-name EventPro-EC2-Role

# firewalls (delete the ALB one only after the ALB is gone)
aws ec2 delete-security-group --group-id "$SG_EC2"
aws ec2 delete-security-group --group-id "$SG_ALB"

# alarms & budget
aws cloudwatch delete-alarms --alarm-names eventpro-ec2-cpu eventpro-alb-5xx
```

Then Console → **Billing** → *Bills* the next day, confirm it's near zero.

---

# Part 6 — Troubleshooting

### Local (Docker)

| Symptom | Fix |
|---|---|
| `port is already allocated` (8001) | `docker rm -f eventpro-ddb ddb-test 2>/dev/null; docker compose down --remove-orphans && docker compose up -d` |
| `migrate` loops on `Could not resolve host: dynamodb` | `docker compose down --remove-orphans && docker compose up -d` |
| Photos show broken | `docker compose up -d --build backend` (rebuilds with `storage:link`) |
| face-worker won't build | retry `docker compose build face-worker` — usually a transient download |

### EC2 / API

| Symptom | Cause / fix |
|---|---|
| ALB target **unhealthy** | SSH in, `curl localhost:8000/up`. If that works → `SG_EC2` isn't allowing 8000 from `SG_ALB`. If it fails → `sudo docker compose -f /opt/eventpro/infra/docker-compose.prod.yml logs api`. |
| Every API call 500s; logs mention `169.254.169.254` or `credentials` | IMDS hop limit. `aws ec2 modify-instance-metadata-options --instance-id $INSTANCE_ID --http-put-response-hop-limit 2 --http-tokens required`, then recreate the container. |
| 500s with `AccessDeniedException` on DynamoDB/S3/Cognito | The IAM policy ARNs don't match. Re-check `$ACCOUNT_ID`, `$POOL_ID`, table/bucket names in `/tmp/eventpro-ec2-policy.json`, then `aws iam put-role-policy ...` again. |
| Boot script failed | `ssh` in → `sudo cat /var/log/cloud-init-output.log`. Usual causes: wrong `REPO`/`BRANCH`, or you didn't push your Cognito-id edit. |
| `dynamo:create-table` → `AccessDenied` | Either keep the `DynamoCreateTableOnce` statement in the policy, or create the table with the CLI (Step 1) and don't run this. |

### Cognito / auth

| Symptom | Cause / fix |
|---|---|
| register/login 500, `User pool ... does not exist` | `COGNITO_USER_POOL_ID` / `COGNITO_REGION` wrong in `/opt/eventpro/infra/.env`. |
| login always 422 with the right password | App client is missing **`ALLOW_ADMIN_USER_PASSWORD_AUTH`** (Step 3). |
| register 500, `NotAuthorizedException: SecretHash` | `COGNITO_CLIENT_SECRET` in `.env` ≠ the app client's secret, or the client has no secret. |
| logged in, but every request is 401 | Token verification failing — the server can't reach `https://cognito-idp.<region>.amazonaws.com/.../jwks.json` (needs outbound 443), or the region/pool don't match. |
| want passwords back for a quick test | Blank `COGNITO_USER_POOL_ID` in `.env`, recreate the container → falls back to local JWT mode. |

### CloudFront / SPA

| Symptom | Cause / fix |
|---|---|
| `/api/*` returns 403 or a weird host error | The `/api/*` behaviour needs origin request policy **AllViewerExceptHostHeader**, and the ALB origin must be **HTTP only**. |
| Deep links (`/dashboard/...`) 404 | Add the `403`→`/index.html` and `404`→`/index.html` (code 200) custom error responses. |
| Changes not showing | Distribution status must be **Deployed** (5–15 min). After a `s3 sync`, run `aws cloudfront create-invalidation --distribution-id $DIST_ID --paths '/*'`. |
| Photos broken but SPA fine | Media bucket policy / CORS from Step 2 missing. |

### Face pipeline

| Symptom | Cause / fix |
|---|---|
| Photos stuck at `processing_status=queued` | `aws sqs get-queue-attributes --queue-url $IDX_URL --attribute-names All` — is the event-source-mapping there (`aws lambda list-event-source-mappings --function-name $IDX_FN`)? Check `aws logs tail /aws/lambda/framefind-index --since 15m`. |
| Messages piling in `FaceIndexDLQ` | The indexer is erroring every time. Read its logs; common cause is the IAM role can't read the S3 object or write DynamoDB. |
| Selfie search returns `unavailable` | `FACE_SEARCH_LAMBDA_NAME` not set in `.env`, or the container wasn't recreated after editing it. |
| Selfie search 502 | The Lambda threw. `aws logs tail /aws/lambda/framefind-search --since 5m`. |
| `docker build` for the image fails on `dlib` | Rare glibc mismatch — see the comment in [`lambda/face-recognition/requirements.txt`](lambda/face-recognition/requirements.txt) for the source-build fallback. |

### Cost

| Symptom | Fix |
|---|---|
| Budget alarm fired | `aws elbv2 describe-load-balancers` and `aws ec2 describe-instances --filters Name=instance-state-name,Values=running` — you left the ALB/EC2 up. Run Part 2.15. |
| Bill shows CloudFront/data transfer | Usually fine (cents). If large, someone's hammering the public URL — disable the distribution. |

---

# Part 7 — Cheat sheet

**The two commands you'll run most:**
```bash
# stop paying (end of every session)
aws elbv2 delete-load-balancer --load-balancer-arn "$ALB_ARN"; aws ec2 terminate-instances --instance-ids "$INSTANCE_ID"

# redeploy backend after a push
ssh -i "$SSH_KEY" ec2-user@$EC2_IP 'sudo bash /opt/eventpro/infra/redeploy.sh'
```

**Where things live in the console:** DynamoDB → Tables · S3 → Buckets · Cognito →
User pools · EC2 → Instances / Security Groups / Key Pairs · EC2 → Load Balancers /
Target Groups · CloudFront → Distributions · Lambda → Functions · SQS → Queues ·
ECR → Repositories · CloudWatch → Log groups / Alarms · IAM → Roles · Billing → Budgets.

**Learn more (AWS docs, ~10 min each):**
- IAM roles for EC2 → search "IAM roles for Amazon EC2"
- DynamoDB core concepts → "DynamoDB Core Components"
- ALB → "What is an Application Load Balancer?"
- CloudFront + S3 → "Restricting access to an Amazon S3 origin" (OAC)
- Cognito → "Amazon Cognito user pools" + "Using tokens with user pools"
- Lambda container images → "Creating Lambda container images"

---

## Appendix — repo files that matter for deployment

| File | Purpose |
|---|---|
| [`docker-compose.yml`](docker-compose.yml) + [`docker-compose.override.yml`](docker-compose.override.yml) | Local dev stack (+ the local face worker) |
| [`backend/Dockerfile`](backend/Dockerfile) | API image — PHP 8.4, runs `artisan serve` |
| [`frontend/Dockerfile`](frontend/Dockerfile) | SPA image — Vite dev server (local only; on AWS the SPA is a static build) |
| [`infra/docker-compose.prod.yml`](infra/docker-compose.prod.yml) | API-only stack that runs on the EC2 server |
| [`infra/ec2-user-data.sh`](infra/ec2-user-data.sh) | EC2 first-boot script — **edit the Cognito IDs before launch** |
| [`infra/redeploy.sh`](infra/redeploy.sh) | Pull + rebuild on the server (Part 4) |
| [`infra/backend.env.prod.example`](infra/backend.env.prod.example) | Reference for every production env var |
| [`infra/iam/ec2-instance-policy.json`](infra/iam/ec2-instance-policy.json) | The server's permissions — DynamoDB + S3 + Cognito + Secrets + face SQS/Lambda, no wildcards |
| [`infra/iam/ec2-trust-policy.json`](infra/iam/ec2-trust-policy.json) | "EC2 may wear this role" |
| [`infra/iam/lambda-faceindex-policy.json`](infra/iam/lambda-faceindex-policy.json) | `framefind-index` — SQS consume, S3 read, DynamoDB write |
| [`infra/iam/lambda-facesearch-policy.json`](infra/iam/lambda-facesearch-policy.json) | `framefind-search` — S3 selfie read/delete, DynamoDB **Query only** |
| [`infra/iam/lambda-trust-policy.json`](infra/iam/lambda-trust-policy.json) | "Lambda may wear these roles" |
| [`lambda/face-recognition/`](lambda/face-recognition/) | The `dlib` image — `Dockerfile`, both handlers, `local_server.py`, tests |
| `backend/app/Console/Commands/` | `dynamo:create-table`, `dynamo:seed`, `dynamo:setup` |
| `backend/app/Auth/` | `AuthBroker` + `LocalAuthBroker` / `CognitoAuthBroker` (the mode switch) |
| [`backend/app/Support/Cognito/CognitoTokenVerifier.php`](backend/app/Support/Cognito/CognitoTokenVerifier.php) | Verifies Cognito's RS256 tokens against the pool JWKS |
| `backend/app/Services/Face/` | `FaceIndexDispatcher` (→ SQS), `FaceSearchClient` (→ Lambda) |
