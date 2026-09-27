#!/usr/bin/env bash
###############################################################################
# EventPro — end-to-end AWS deployment automation
#
# Usage:
#   ./deploy.sh up             # full deploy: infra + app + face-search, one command
#   ./deploy.sh infra-only     # just the CloudFormation stack (EnableFaceSearch=false)
#   ./deploy.sh app-fix        # re-run the remote .env/seed/storage-link step only
#   ./deploy.sh push-image     # build + push the face-recognition image to ECR
#   ./deploy.sh enable-faces   # stack update to EnableFaceSearch=true + remote .env
#   ./deploy.sh frontend       # build React app and sync to S3 + invalidate CloudFront
#   ./deploy.sh outputs        # show stack outputs
#   ./deploy.sh key            # fetch the SSH private key
#   ./deploy.sh down           # delete the whole stack (empties S3 buckets first)
#
# Requires: aws cli v2 (configured), docker, git, an SSH client.
# Run this from the repo root (where infra/ and frontend/ live).
###############################################################################

set -euo pipefail

export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1

STACK_NAME="eventpro-production"
TEMPLATE="infra/cloundformatter-template.yaml"
REPO_URL="https://github.com/PrantaRoy/Cloud-Based-AI-Powered-Event-Photo-Sharing-Platform"
REPO_BRANCH="main"
KEY_NAME="eventpro-key"
SSH_KEY="$HOME/.ssh/${KEY_NAME}.pem"
FACE_IMAGE_DIR="lambda/face-recognition"    # <-- change this to the real Dockerfile path in your repo
FACE_IMAGE_NAME="framefind-faces"
IMAGE_TAG="latest"
BUDGET_EMAIL="${BUDGET_EMAIL:?run: export BUDGET_EMAIL=you@example.com, then re-run this script}"

log()  { echo -e "\n\033[1;33m▶ $1\033[0m"; }
ok()   { echo -e "\033[1;32m  ✓ $1\033[0m"; }
warn() { echo -e "\033[1;31m  ⚠ $1\033[0m"; }

common_params() {
  VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
    --query 'Vpcs[0].VpcId' --output text)
  SUBNET_IDS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" \
    Name=map-public-ip-on-launch,Values=true \
    --query 'Subnets[0:2].SubnetId' --output text | tr '\t' ',')
  MY_IP="$(curl -s https://checkip.amazonaws.com)/32"
}

get_output() {
  aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

ensure_key() {
  [[ -f "$SSH_KEY" ]] && return
  log "Retrieving the SSH private key"
  local key_id
  key_id=$(aws ec2 describe-key-pairs --key-names "$KEY_NAME" \
    --query 'KeyPairs[0].KeyPairId' --output text)
  aws ssm get-parameter --name "/ec2/keypair/${key_id}" --with-decryption \
    --query Parameter.Value --output text > "$SSH_KEY"
  chmod 400 "$SSH_KEY"
  ok "Key saved to: $SSH_KEY"
}

wait_for_ssh() {
  local ip="$1"
  log "Waiting for SSH to become ready ($ip)..."
  for i in {1..30}; do
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i "$SSH_KEY" \
        ec2-user@"$ip" 'true' 2>/dev/null; then
      ok "SSH is ready"
      return
    fi
    sleep 10
  done
  warn "SSH was not ready after 5 minutes — check manually"
  exit 1
}

# ---------------------------------------------------------------------------
# Step 1 — CloudFormation core stack
# ---------------------------------------------------------------------------
infra_only() {
  common_params
  log "Deploying core stack (EnableFaceSearch=false)"
  aws cloudformation deploy \
    --stack-name "$STACK_NAME" \
    --template-file "$TEMPLATE" \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
        VpcId="$VPC_ID" \
        PublicSubnetIds="$SUBNET_IDS" \
        MyIpForSsh="$MY_IP" \
        RepoUrl="$REPO_URL" \
        RepoBranch="$REPO_BRANCH" \
        EnableFaceSearch=false \
        BudgetAlertEmail="$BUDGET_EMAIL"
  ok "Core stack is ready"
}

# ---------------------------------------------------------------------------
# Step 2 — SSH into EC2 to fix .env, build, seed, storage:link
#          (this whole step used to be done manually — now automated)
# ---------------------------------------------------------------------------
app_fix() {
  ensure_key
  local instance_id ec2_ip cloudfront media_bucket pool_id client_id
  instance_id=$(get_output Ec2InstanceId)
  ec2_ip=$(aws ec2 describe-instances --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
  cloudfront=$(get_output CloudFrontDomain)
  media_bucket=$(get_output MediaBucketName)
  pool_id=$(get_output UserPoolId)
  client_id=$(get_output UserPoolClientId)

  wait_for_ssh "$ec2_ip"

  log "Writing .env on EC2, building the container, seeding data (this takes a few minutes)"
  ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ec2-user@"$ec2_ip" bash -s <<EOF
set -e
cd /opt/eventpro/infra 2>/dev/null || { sudo git clone --branch $REPO_BRANCH --depth 1 $REPO_URL /opt/eventpro && cd /opt/eventpro/infra; }

APP_KEY=\$(aws secretsmanager get-secret-value --secret-id eventpro/app-key --region us-east-1 --query SecretString --output text)
COGNITO_SECRET=\$(aws secretsmanager get-secret-value --secret-id eventpro/cognito-client-secret --region us-east-1 --query SecretString --output text)

sudo tee .env > /dev/null <<ENVEOF
APP_NAME=EventPro
APP_ENV=production
APP_DEBUG=false
APP_KEY=\${APP_KEY}
JWT_SECRET=unused-in-cognito-mode
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=${pool_id}
COGNITO_CLIENT_ID=${client_id}
COGNITO_CLIENT_SECRET=\${COGNITO_SECRET}
APP_URL=https://${cloudfront}
FRONTEND_URL=https://${cloudfront}
LOG_CHANNEL=stderr
LOG_LEVEL=warning
SESSION_DRIVER=array
CACHE_STORE=file
QUEUE_CONNECTION=sync
QUEUE_FAILED_DRIVER=null
BROADCAST_CONNECTION=log
MAIL_MAILER=log
AWS_DEFAULT_REGION=us-east-1
AWS_USE_PATH_STYLE_ENDPOINT=false
DYNAMODB_TABLE=EventPhotoPlatform-prod
DYNAMODB_REGION=us-east-1
FILESYSTEM_DISK=s3
AWS_BUCKET=${media_bucket}
AWS_URL=https://${cloudfront}
FACE_SEARCH_LAMBDA_NAME=
FACE_INDEX_QUEUE_URL=
FACE_MATCH_THRESHOLD=0.55
ENVEOF

sudo docker compose -f docker-compose.prod.yml up -d --build
sleep 5
sudo docker compose -f docker-compose.prod.yml exec -T api php artisan dynamo:seed --fresh || true
sudo docker compose -f docker-compose.prod.yml exec -T api php artisan storage:link || true
curl -sf localhost:8000/up && echo "OK: backend is up"
EOF
  ok "App fix complete — open https://${cloudfront}/login to test"
}

# ---------------------------------------------------------------------------
# Step 3 — build and push the face-recognition image
# ---------------------------------------------------------------------------
push_image() {
  log "Building and pushing the framefind-faces image"
  local account_id ecr_uri
  account_id=$(aws sts get-caller-identity --query Account --output text)
  ecr_uri="${account_id}.dkr.ecr.${AWS_REGION}.amazonaws.com/${FACE_IMAGE_NAME}"

  [[ -d "$FACE_IMAGE_DIR" ]] || { warn "'$FACE_IMAGE_DIR' not found — fix FACE_IMAGE_DIR inside the script"; exit 1; }

  aws ecr get-login-password --region "$AWS_REGION" \
    | docker login --username AWS --password-stdin "${account_id}.dkr.ecr.${AWS_REGION}.amazonaws.com"
  docker build --platform linux/amd64 -t "${FACE_IMAGE_NAME}:${IMAGE_TAG}" "$FACE_IMAGE_DIR"
  docker tag "${FACE_IMAGE_NAME}:${IMAGE_TAG}" "${ecr_uri}:${IMAGE_TAG}"
  docker push "${ecr_uri}:${IMAGE_TAG}"
  ok "Push complete: ${ecr_uri}:${IMAGE_TAG}"
}

# ---------------------------------------------------------------------------
# Step 4 — EnableFaceSearch=true + set Lambda/queue names in the remote .env
# ---------------------------------------------------------------------------
enable_faces() {
  common_params
  log "Updating the stack (EnableFaceSearch=true)"
  aws cloudformation deploy \
    --stack-name "$STACK_NAME" \
    --template-file "$TEMPLATE" \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
        VpcId="$VPC_ID" \
        PublicSubnetIds="$SUBNET_IDS" \
        MyIpForSsh="$MY_IP" \
        RepoUrl="$REPO_URL" \
        RepoBranch="$REPO_BRANCH" \
        EnableFaceSearch=true \
        FaceEcrImageTag="$IMAGE_TAG" \
        BudgetAlertEmail="$BUDGET_EMAIL"

  local lambda_name queue_url instance_id ec2_ip
  lambda_name=$(aws lambda list-functions --region "$AWS_REGION" \
    --query "Functions[?contains(FunctionName, 'search')].FunctionName" --output text)
  queue_url=$(get_output FaceIndexQueueUrl)
  instance_id=$(get_output Ec2InstanceId)
  ec2_ip=$(aws ec2 describe-instances --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

  ensure_key
  log "Setting face-search environment variables on EC2"
  ssh -o StrictHostKeyChecking=no -i "$SSH_KEY" ec2-user@"$ec2_ip" bash -s <<EOF
cd /opt/eventpro/infra
sudo sed -i \
  -e 's#^FACE_SEARCH_LAMBDA_NAME=.*#FACE_SEARCH_LAMBDA_NAME=${lambda_name}#' \
  -e 's#^FACE_INDEX_QUEUE_URL=.*#FACE_INDEX_QUEUE_URL=${queue_url}#' \
  .env
sudo docker compose -f docker-compose.prod.yml up -d --force-recreate api
EOF
  ok "Face-search pipeline is live"
}

# ---------------------------------------------------------------------------
frontend_deploy() {
  local spa_bucket cloudfront_id
  spa_bucket=$(get_output SpaBucketName)
  cloudfront_id=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Origins.Items[?DomainName=='${spa_bucket}.s3.${AWS_REGION}.amazonaws.com']] | [0].Id" --output text)

  log "Building the frontend"
  (cd frontend && echo 'VITE_API_URL=/api' > .env.production && npm ci && npm run build)
  aws s3 sync frontend/dist/ "s3://${spa_bucket}/" --delete
  [[ -n "$cloudfront_id" && "$cloudfront_id" != "None" ]] && \
    aws cloudfront create-invalidation --distribution-id "$cloudfront_id" --paths '/*' >/dev/null
  ok "Frontend deploy complete"
}

outputs() { aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs' --output table; }

down() {
  local media_bucket spa_bucket
  media_bucket=$(get_output MediaBucketName 2>/dev/null || true)
  spa_bucket=$(get_output SpaBucketName 2>/dev/null || true)
  [[ -n "$media_bucket" ]] && aws s3 rm "s3://$media_bucket" --recursive 2>/dev/null || true
  [[ -n "$spa_bucket" ]] && aws s3 rm "s3://$spa_bucket" --recursive 2>/dev/null || true
  aws cloudformation delete-stack --stack-name "$STACK_NAME"
  aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME"
  ok "Stack fully deleted"
}

up() {
  infra_only
  app_fix
  push_image
  enable_faces
  frontend_deploy
  outputs
  echo -e "\n✅ Full deployment complete — https://$(get_output CloudFrontDomain)"
}

case "${1:-}" in
  up)            up ;;
  infra-only)    infra_only ;;
  app-fix)       app_fix ;;
  push-image)    push_image ;;
  enable-faces)  enable_faces ;;
  frontend)      frontend_deploy ;;
  outputs)       outputs ;;
  key)           ensure_key ;;
  down)          down ;;
  *)
    echo "Usage: $0 {up|infra-only|app-fix|push-image|enable-faces|frontend|outputs|key|down}"
    exit 1
    ;;
esac