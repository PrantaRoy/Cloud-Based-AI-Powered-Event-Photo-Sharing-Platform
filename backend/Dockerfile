# EventPro API — Laravel 13 on PHP 8.4, DynamoDB-backed (no RDBMS).
# (composer.lock resolves symfony 8.x, which needs PHP >= 8.4.1.)
FROM php:8.4-cli-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libicu-dev libzip-dev libonig-dev \
    && docker-php-ext-install -j"$(nproc)" bcmath intl zip pcntl opcache \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Install PHP deps first so the layer caches across source changes.
COPY composer.json composer.lock ./
RUN composer install --no-interaction --no-scripts --no-autoloader --prefer-dist

COPY . .
RUN composer dump-autoload --optimize

EXPOSE 8000
CMD ["sh", "-c", "php artisan config:clear && php artisan serve --host=0.0.0.0 --port=8000"]
