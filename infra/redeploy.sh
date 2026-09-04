#!/bin/bash
# Pull the latest code and restart the API container. Run on the EC2 host.
#   ssh ec2-user@<ip> 'sudo bash /opt/eventpro/infra/redeploy.sh'
set -euxo pipefail
cd /opt/eventpro
git fetch --all
git reset --hard "@{u}"
docker compose -f infra/docker-compose.prod.yml up -d --build
docker compose -f infra/docker-compose.prod.yml exec -T api php artisan config:cache
docker compose -f infra/docker-compose.prod.yml exec -T api php artisan dynamo:create-table
