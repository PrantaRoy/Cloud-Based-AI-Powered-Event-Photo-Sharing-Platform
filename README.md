# EventPro (Frame & Find) — AI-based event photo sharing

An event photo-sharing platform where attendees upload photos, then find the
ones they're in using selfie-based face matching. Built with Laravel (API),
React (SPA), and a serverless face-recognition pipeline on AWS.

## Architecture at a glance

```
User (browser)
    │
    ▼
CloudFront (CDN)
    ├──▶ S3 — React SPA (static frontend)
    └──▶ ALB ──▶ EC2 — Laravel API
                     ├──▶ DynamoDB   (events, photos, face data)
                     ├──▶ S3         (photo storage)
                     ├──▶ Cognito    (auth, JWT)
                     ├──▶ Secrets Manager (app key, Cognito secret)
                     └──▶ SQS ──▶ Lambda (face index/search, dlib) ──▶ DynamoDB
```

Full write-up: see `docs/ARCHITECTURE.md` (or ask in the project chat history —
every design decision is explained there, including *why* each service was
chosen over the alternatives).

## Prerequisites

- Docker + Docker Compose (local development)
- AWS CLI v2, configured (`aws configure`) with credentials for an account/role
  that can create the resources below
- Node.js 18+ and npm (frontend build)
- An SSH client
- `jq` (optional, used by some AWS CLI query examples)

## Local development

The full stack (DynamoDB Local + Laravel API + React SPA) runs in Docker —
no AWS account needed for local dev.

```bash
git clone <this-repo-url>
cd eventpro

docker compose up -d --build      # builds and starts everything
docker compose run --rm seed      # loads demo data (admin@eventpro.com / password)
```

Open:
- Frontend: http://localhost:5173
- API: http://localhost:8000
- API health check: http://localhost:8000/up

Stop everything:
```bash
docker compose down
```

DynamoDB Local runs in-memory — data resets every time the stack stops.

## AWS deployment (production)

Everything is defined as code in `infra/cloundformatter-template.yaml`
(CloudFormation) and orchestrated by `deploy.sh`. **Region: `us-east-1`.**

### One-time setup

1. Make sure your AWS CLI is authenticated against the target account:
   ```bash
   aws sts get-caller-identity
   ```
2. Set the email that should receive budget alerts:
   ```bash
   export BUDGET_EMAIL="you@example.com"
   ```
3. Make `deploy.sh` executable:
   ```bash
   chmod +x deploy.sh
   ```

### Full deploy — one command

```bash
./deploy.sh up
```

This runs, in order:

| Step | What it does |
|---|---|
| `infra-only` | Deploys the CloudFormation stack: DynamoDB, S3 (media + SPA), Cognito, Secrets Manager, IAM role, EC2, ALB, CloudFront, CloudWatch alarms, AWS Budget. `EnableFaceSearch` starts `false` because the face-recognition container image doesn't exist yet. |
| `app-fix` | SSHes into the new EC2 instance, writes a correct `.env` (using the real Cognito pool/client IDs, S3 bucket name, and CloudFront domain the stack just created), builds and starts the Laravel container, seeds demo data, and creates the storage symlink. |
| `push-image` | Builds the `framefind-faces` Docker image (dlib-based face-recognition code) and pushes it to the ECR repository the stack created. |
| `enable-faces` | Updates the stack with `EnableFaceSearch=true`, which adds the SQS queue and the two Lambda functions (`*-index`, `*-search`). Then SSHes back into EC2 to fill in the now-known Lambda name and queue URL and restarts the API container. |
| `frontend` | Builds the React app and syncs it to the SPA S3 bucket, then invalidates the CloudFront cache. |

At the end it prints the CloudFront URL — that's the live site.

### Running steps individually

Each step above is also its own subcommand, useful when re-running just one
part (e.g. after a code change):

```bash
./deploy.sh infra-only     # (re)create just the CloudFormation stack
./deploy.sh app-fix        # re-push .env + rebuild + reseed on EC2
./deploy.sh push-image     # rebuild and re-push the face-recognition image
./deploy.sh enable-faces   # turn on / refresh the face-search pipeline
./deploy.sh frontend       # rebuild and redeploy just the React app
./deploy.sh outputs        # print all stack outputs (URLs, IDs)
./deploy.sh key            # fetch the EC2 SSH private key to ~/.ssh/
```

### Tearing down

```bash
./deploy.sh down
```

Empties both S3 buckets (required before CloudFormation can delete them) and
deletes the whole stack. DynamoDB, S3, Cognito, IAM, Lambda, SQS, ALB, EC2,
CloudFront, and the CloudWatch alarms are all removed. The ECR repository and
its stored image are **not** deleted automatically (ECR is not part of the
stack's lifecycle) — remove it separately at the end of the project:

```bash
aws ecr batch-delete-image --repository-name framefind-faces --region us-east-1 \
  --image-ids imageTag=latest
```

### Cost discipline

The AWS Budget created by the stack sends email alerts at several spend
thresholds. Idle resources (DynamoDB, S3, Cognito, Lambda, SQS) cost close to
nothing when the app isn't being used — the EC2 instance and the ALB are the
only components billed by the hour regardless of traffic. **Run `./deploy.sh
down` when you're done with a demo/testing session** rather than leaving the
stack up continuously.

## Environment variables

The `.env` file consumed by the Laravel container is generated automatically
by `deploy.sh app-fix` in production (values pulled from Secrets Manager and
the CloudFormation stack outputs) and by `docker-compose.yml`'s `x-api-env`
block locally. You should not need to hand-edit it, but the full reference is
in `infra/backend.env.prod.example`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `502 Bad Gateway` right after deploy | The EC2 startup script is still installing Docker / building the image | Wait 2-3 minutes, retry. Check `sudo tail -f /var/log/cloud-init-output.log` on the instance. |
| `git clone` fails on EC2 with "could not read Username" | The GitHub repo is private and no deploy key is configured | Either make the repo public, or add an SSH deploy key (see `infra/DEPLOY_KEY.md` if present) |
| `.env` change has no effect | Container was `restart`ed instead of recreated | `env_file` is only read at container **creation**. Use `docker compose up -d --force-recreate api`, not `restart`. |
| `AccessDeniedException` running an AWS CLI command from inside EC2 | The EC2 IAM role is intentionally least-privilege | Run that command from your own machine with your admin/IAM user credentials instead. |
| CloudFront returns S3's `AccessDenied` XML for `/api/*` | Usually transient edge-cache propagation right after the distribution is created | Retry after a few minutes, or create a `/*` invalidation. |
| Broken image `<img>` links (`/event-media/...` instead of a full URL) | `AWS_URL` wasn't set in `.env` when the container started | Handled automatically by `deploy.sh app-fix`; if editing manually, remember to `--force-recreate`, not `restart`. |

## Security notes

- The EC2 instance has no static AWS access keys — it assumes an IAM role
  (`EventPro-EC2-Role`) scoped to only the specific DynamoDB table, S3
  buckets, Cognito pool, and secrets this project uses (no `Resource: "*"`).
- Authentication is handled entirely by Amazon Cognito (password policy,
  email verification, JWT issuance) — no custom password storage in the app.
- The Laravel app key and Cognito client secret are stored in AWS Secrets
  Manager, not committed to the repo or baked into the Docker image.
- Uploaded reference selfies are deleted automatically after 24 hours via an
  S3 lifecycle rule; face matching only runs for users who have opted in.

## Cost model reference

Approximate cost with disciplined shutdown between sessions (compute is the
dominant cost; everything else is usage-based and close to free at this
scale): **under $1.20/day while running**, near $0 while the stack is deleted.
See the project's cost-tracking notes for the current AWS Budget status.