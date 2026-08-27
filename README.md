# EventPro

EventPro is split into two applications:

- `backend/`: Laravel API application
- `frontend/`: React and Vite client application

## Requirements

Install the following locally:

- PHP 8.3 or newer
- Composer
- Node.js and npm
- SQLite (the default local database)

## First-time setup

From the repository root:

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
php artisan storage:link

cd ../frontend
npm install
```

The backend uses SQLite by default. If the SQLite database file does not exist, create it before running migrations:

```bash
cd backend
touch database/database.sqlite
php artisan migrate
```

Edit `backend/.env` if you need AWS, mail, Redis, or another database connection. The frontend uses the Laravel API at `http://localhost:8000/api` by default.

## Run locally

Open two terminal windows from the repository root.

### Terminal 1: Laravel backend

```bash
cd backend
php artisan serve --host=127.0.0.1 --port=8000
```

Backend URL: <http://127.0.0.1:8000>

### Terminal 2: React frontend

```bash
cd frontend
npm run dev -- --host=127.0.0.1 --port=5173
```

Frontend URL: <http://127.0.0.1:5173>

To use a different API URL, create `frontend/.env` with:

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

## Useful commands

Run backend tests:

```bash
cd backend
php artisan test
```

Build the frontend:

```bash
cd frontend
npm run build
```

Run Laravel database migrations after pulling changes:

```bash
cd backend
php artisan migrate
```

## Troubleshooting

- If the frontend cannot reach the API, confirm that the backend is running on port `8000` and that `VITE_API_URL` is correct.
- If Laravel reports a missing application key, run `cd backend && php artisan key:generate`.
- If database tables are missing, run `cd backend && php artisan migrate`.
- Stop either development server with `Ctrl+C`.
