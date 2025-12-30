# Sympto Backend (API)

This folder contains the **Node.js + Express** backend API for the Sympto Health Assessment Platform.

## Responsibilities

- User authentication (register/login/logout) using JWT access + refresh tokens
- Email verification + password reset flows
- CRUD for health assessments
- Stores data in MongoDB via Mongoose
- Encrypts sensitive health/lab values at rest
- Integrates with an external AI service for assessment analysis
- Exposes a public AI warm-up endpoint to reduce Render cold starts

## Tech Stack

- Node.js (ESM) + Express
- MongoDB + Mongoose
- JWT auth (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- Security: Helmet, CORS allow-list, rate limiting

## Getting Started (Local)

### Prerequisites

- Node.js 18+
- MongoDB running locally or MongoDB Atlas

### Install

```bash
cd backend
npm install
```

### Configure environment

Copy the sample env file and update values:

```bash
cp .env.example .env
```

Common required values for local dev:

- `MONGODB_URI`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `ENCRYPTION_KEY`
- `FRONTEND_URL`
- `AI_MODEL_URL` (optional if you are not running analysis)

### Run

Dev (auto-reload):

```bash
npm run dev
```

Production:

```bash
npm start
```

API defaults:

- Base: `http://localhost:5000/api`
- Health: `http://localhost:5000/health`

## Scripts

- `npm run dev` – start with nodemon
- `npm start` – start server
- `npm test` – run Jest tests
- `npm run lint` / `npm run lint:fix`
- `npm run format`

Crypto utilities:

- `npm run generate-keys` – generate encryption keys (if needed)
- `npm run crypto:scan-users` – scan for undecryptable users
- `npm run crypto:cleanup-users` – delete undecryptable users (dangerous)

## API Notes

### AI warm-up (public)

- `GET /api/ai/health`

This calls the external AI service `/health` endpoint. It’s designed to be safe to call on site open to wake sleeping Render instances.

### Assessments analysis (private)

- `POST /api/assessments/:id/analyze`

Returns `503` if the external AI service is unavailable.

## Deployment

Typical:

- Deploy this backend to Render.
- Set CORS env vars (`FRONTEND_URL` or `FRONTEND_URLS`) to your deployed frontend.
- Set `TRUST_PROXY=true` in production when behind Render’s proxy.

## More Documentation

See the repo-level guide: [../DOCUMENTATION.md](../DOCUMENTATION.md)
