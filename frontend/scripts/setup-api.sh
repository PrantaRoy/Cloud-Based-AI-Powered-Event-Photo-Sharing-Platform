#!/usr/bin/env bash
set -e
cd /workspace

if [ -d "api" ]; then
  echo "api/ already exists — skipping composer install"
else
  echo "📦 Installing Laravel 11..."
  composer create-project laravel/laravel api --quiet
  cd api
  composer require aws/aws-sdk-php --quiet
  cd ..
fi

echo "📂 Copying custom source files..."
cp -r api-src/routes/api.php          api/routes/api.php
cp -r api-src/app/Http/Controllers/. api/app/Http/Controllers/
cp -r api-src/app/Http/Middleware/.   api/app/Http/Middleware/
cp -r api-src/app/Services/.          api/app/Services/
cp    api-src/.env.local              api/.env
cp    api-src/bootstrap/app.php       api/bootstrap/app.php

cd api
php artisan key:generate --quiet
echo "✅ Laravel API ready"

echo ""
echo "⚡ Seeding DynamoDB Local tables..."
cd /workspace
php scripts/seed-dynamo.php
echo ""
echo "🚀 Start dev servers:"
echo "  React  → cd /workspace && npm run dev"
echo "  Laravel → cd /workspace/api && php artisan serve --host=0.0.0.0 --port=8000"
