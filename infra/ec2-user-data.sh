#!/bin/bash
# EventPro API — EC2 bootstrap (Amazon Linux 2023).
# Paste this as the instance "User data". Runs once on first boot.
set -euxo pipefail

REGION=ap-southeast-2
REPO=https://github.com/PrantaRoy/Ai-Powered-Event-Photo-AWS-Cloud-Project-.git
BRANCH=main
APP_DIR=/opt/eventpro

# --- FILL THESE IN from Step 3 (Cognito) and Step 7 (CloudFront) ----------
COGNITO_USER_POOL_ID=ap-southeast-2_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
PUBLIC_URL=https://xxxxxxxxxxxxxx.cloudfront.net   # or http://<alb-dns> before CloudFront exists

# --- swap (t3.micro has 1 GB RAM; composer/docker build needs headroom) ---
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# --- packages ------------------------------------------------------------
dnf update -y
dnf install -y docker git jq
systemctl enable --now docker
usermod -aG docker ec2-user
# docker compose v2 plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -sSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# --- code --------------------------------------------------------------
rm -rf "$APP_DIR"
git clone --branch "$BRANCH" --depth 1 "$REPO" "$APP_DIR"
cd "$APP_DIR"

# --- .env from Secrets Manager --------------------------------------------
APP_KEY=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id eventpro/app-key --query SecretString --output text)
COGNITO_CLIENT_SECRET=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id eventpro/cognito-client-secret --query SecretString --output text)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

cat > "$APP_DIR/infra/.env" <<EOF
APP_NAME=EventPro
APP_ENV=production
APP_DEBUG=false
APP_KEY=${APP_KEY}
JWT_SECRET=unused-in-cognito-mode
COGNITO_REGION=${REGION}
COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID}
COGNITO_CLIENT_ID=${COGNITO_CLIENT_ID}
COGNITO_CLIENT_SECRET=${COGNITO_CLIENT_SECRET}
APP_URL=${PUBLIC_URL}
FRONTEND_URL=${PUBLIC_URL}
LOG_CHANNEL=stderr
LOG_LEVEL=warning
SESSION_DRIVER=array
CACHE_STORE=file
QUEUE_CONNECTION=sync
QUEUE_FAILED_DRIVER=null
BROADCAST_CONNECTION=log
MAIL_MAILER=log
AWS_DEFAULT_REGION=${REGION}
AWS_USE_PATH_STYLE_ENDPOINT=false
DYNAMODB_TABLE=EventPhotoPlatform-prod
DYNAMODB_REGION=${REGION}
FILESYSTEM_DISK=s3
AWS_BUCKET=eventpro-media-${ACCOUNT_ID}
AWS_URL=
EOF

# --- build + run --------------------------------------------------------
docker compose -f infra/docker-compose.prod.yml up -d --build

# --- create the DynamoDB table (idempotent) -----------------------------
docker compose -f infra/docker-compose.prod.yml exec -T api php artisan dynamo:create-table

# Optional demo data (only run once, and only for a demo):
# docker compose -f infra/docker-compose.prod.yml exec -T api php artisan dynamo:seed --fresh
