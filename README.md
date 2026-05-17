# SabScript

A collaborative fiction platform where stories evolve one round at a time.

## Core Loop

1. A seed (premise) is posted.
2. The community submits the next 100-200 words.
3. Votes decide the winning continuation, which becomes canon.

## Features

- Story rounds, submissions, and voting
- Seed (premise) posting and voting
- Threaded comments on submissions and seeds
- Story bookmarks (surface on homepage/profile)
- Stars for comments and seeds (surface on profile)
- Moderation tools and role-based access

## Tech Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- NextAuth (Google OAuth)

## Quickstart

### Prerequisites

- Node.js 18+
- npm
- PostgreSQL (local or hosted)

### Setup

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

See `.env.example` for required variables:

- `DATABASE_URL`
- `DIRECT_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET` (or `AUTH_SECRET`)
- `NEXTAUTH_URL`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production app
- `npm run start` - Start production server
- `npm run db:migrate` - Create/apply dev migrations
- `npm run db:generate` - Generate Prisma client
- `npm run db:seed` - Seed database

## Open Source Docs

- [Contributing](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)
- [License](./LICENSE)

## Admin Bootstrap

After migration, promote an account in SQL:

```sql
UPDATE "User" SET "role" = 'admin' WHERE "id" = '<your-user-id>';
```

Regular users default to `user`.
