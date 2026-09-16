#!/usr/bin/env bash
###############################################################################
# EventPro — CloudFormation দিয়ে ডিপ্লয়মেন্ট (cloundformatter-template.yaml)
#
# ব্যবহার:
#   ./deploy.sh init          # ধাপ ১: core stack (EnableFaceSearch=false)
#   ./deploy.sh push-image    # ধাপ ২: framefind-faces ইমেজ ECR-এ push
#   ./deploy.sh enable-faces  # ধাপ ৩: stack update (EnableFaceSearch=true)
#   ./deploy.sh outputs       # ALB DNS, CloudFront domain ইত্যাদি
#   ./deploy.sh key           # SSH প্রাইভেট কী বের করে
#   ./deploy.sh frontend      # frontend build + S3 sync + CloudFront invalidate
#   ./deploy.sh down          # পুরো স্ট্যাক মুছে দেয় (বাকেট আগে খালি করে)
###############################################################################

set -euo pipefail

export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1

STACK_NAME="eventpro"
TEMPLATE="cloundformatter-template.yaml"
BUDGET_EMAIL="${BUDGET_EMAIL:?BUDGET_EMAIL env var সেট করুন, e.g. export BUDGET_EMAIL=you@example.com}"

# --- Lambda ইমেজের Dockerfile কোথায় আছে সেটা আপনার repo অনুযায়ী ঠিক করুন ---
FACE_IMAGE_DIR="face-recognition"      # <-- এই পাথটা আপনার repo-র সাথে মিলিয়ে নিন
FACE_IMAGE_NAME="framefind-faces"
IMAGE_TAG="latest"

log() { echo -e "\n\033[1;33m▶ $1\033[0m"; }
ok()  { echo -e "\033[1;32m  ✓ $1\033[0m"; }

common_params() {
  VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
    --query 'Vpcs[0].VpcId' --output text)
  SUBNET_IDS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" \
    Name=map-public-ip-on-launch,Values=true \
    --query 'Subnets[0:2].SubnetId' --output text | tr '\t' ',')
  MY_IP="$(curl -s https://checkip.amazonaws.com)/32"
  echo "VPC=$VPC_ID  Subnets=$SUBNET_IDS  MyIP=$MY_IP"
}

init() {
  common_params
  log "ধাপ ১: core stack তৈরি করছি (EnableFaceSearch=false) — ECR repo সহ, Lambda/SQS ছাড়া"

  aws cloudformation deploy \
    --stack-name "$STACK_NAME" \
    --template-file "$TEMPLATE" \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
        VpcId="$VPC_ID" \
        PublicSubnetIds="$SUBNET_IDS" \
        MyIpForSsh="$MY_IP" \
        EnableFaceSearch=false \
        BudgetAlertEmail="$BUDGET_EMAIL"

  ok "core stack তৈরি হয়েছে"
  outputs
  echo -e "\nএখন './deploy.sh push-image' চালান, তারপর './deploy.sh enable-faces'"
}

push_image() {
  log "framefind-faces ইমেজ বানিয়ে ECR-এ push করছি"
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/framefind-faces"

  [[ -d "$FACE_IMAGE_DIR" ]] || { echo "'$FACE_IMAGE_DIR' পাওয়া যায়নি — স্ক্রিপ্টের ভেতরে FACE_IMAGE_DIR ঠিক করুন"; exit 1; }

  aws ecr get-login-password --region "$AWS_REGION" \
    | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

  docker build -t "${FACE_IMAGE_NAME}:${IMAGE_TAG}" "$FACE_IMAGE_DIR"
  docker tag "${FACE_IMAGE_NAME}:${IMAGE_TAG}" "${ECR_URI}:${IMAGE_TAG}"
  docker push "${ECR_URI}:${IMAGE_TAG}"

  ok "push সম্পন্ন: ${ECR_URI}:${IMAGE_TAG}"
}

enable_faces() {
  common_params
  log "ধাপ ৩: stack আপডেট করছি (EnableFaceSearch=true) — SQS + দুইটা Lambda তৈরি হবে"

  aws cloudformation deploy \
    --stack-name "$STACK_NAME" \
    --template-file "$TEMPLATE" \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
        VpcId="$VPC_ID" \
        PublicSubnetIds="$SUBNET_IDS" \
        MyIpForSsh="$MY_IP" \
        EnableFaceSearch=true \
        FaceEcrImageTag="$IMAGE_TAG" \
        BudgetAlertEmail="$BUDGET_EMAIL"

  ok "face-search পাইপলাইন সচল হয়েছে"
  outputs
}

outputs() {
  aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs' --output table
}

get_key() {
  KEY_PAIR_ID=$(aws ec2 describe-key-pairs --key-names eventpro-key \
    --query 'KeyPairs[0].KeyPairId' --output text)
  aws ssm get-parameter --name "/ec2/keypair/${KEY_PAIR_ID}" \
    --with-decryption --query Parameter.Value --output text > ~/.ssh/eventpro-key.pem
  chmod 400 ~/.ssh/eventpro-key.pem
  ok "কী সেভ হয়েছে: ~/.ssh/eventpro-key.pem"
}

frontend() {
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  SPA_BUCKET="eventpro-spa-${ACCOUNT_ID}"

  log "Frontend build করছি"
  cd frontend
  echo 'VITE_API_URL=/api' > .env.production
  npm ci && npm run build

  log "S3-তে sync করছি"
  aws s3 sync dist/ "s3://${SPA_BUCKET}/" --delete
  cd ..

  DIST_ID=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Origins.Items[?DomainName=='${SPA_BUCKET}.s3.${AWS_REGION}.amazonaws.com']]|[0].Id" --output text)
  if [[ -n "$DIST_ID" && "$DIST_ID" != "None" ]]; then
    aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths '/*' >/dev/null
    ok "CloudFront invalidation পাঠানো হয়েছে"
  fi
}

down() {
  log "S3 বাকেট খালি করছি"
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  aws s3 rm "s3://eventpro-media-${ACCOUNT_ID}" --recursive 2>/dev/null || true
  aws s3 rm "s3://eventpro-spa-${ACCOUNT_ID}" --recursive 2>/dev/null || true

  log "Stack মুছছি: $STACK_NAME"
  aws cloudformation delete-stack --stack-name "$STACK_NAME"
  aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME"
  ok "সম্পূর্ণ স্ট্যাক মোছা হয়েছে"
}

case "${1:-}" in
  init)         init ;;
  push-image)   push_image ;;
  enable-faces) enable_faces ;;
  outputs)      outputs ;;
  key)          get_key ;;
  frontend)     frontend ;;
  down)         down ;;
  *)
    echo "ব্যবহার: $0 {init|push-image|enable-faces|outputs|key|frontend|down}"
    exit 1
    ;;
esac
