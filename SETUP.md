# Review & Handoff System — Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm** (bundled with Node.js) or **yarn** (`npm install -g yarn`)
- **Supabase CLI** — installed in step 3
- **Vercel CLI** — installed in step 8 (optional)
- **Git** — [git-scm.com](https://git-scm.com)

---

## 1. Clone & Install

```bash
git clone https://github.com/your-org/review-handoff-system.git
cd review-handoff-system
npm install
```

If you use yarn:

```bash
yarn install
```

---

## 2. Create a Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New project** and fill in the project name, database password, and region.
3. Wait for the project to finish provisioning (usually 1–2 minutes).
4. Navigate to **Project Settings > API** and note the following values — you will need them in step 5:
   - **Project URL** (e.g. `https://xxxxxxxxxxxx.supabase.co`)
   - **anon / public key**
   - **service_role key** (keep this secret — never expose it client-side)
5. Navigate to **Project Settings > General** and note the **Reference ID** (e.g. `xxxxxxxxxxxx`) — needed in steps 3 and 6.

---

## 3. Link the Supabase CLI

Install the Supabase CLI globally:

```bash
npm install -g supabase
```

Log in to your Supabase account:

```bash
supabase login
```

Initialise Supabase in the project root (skip if a `supabase/` folder already exists):

```bash
supabase init
```

Link your local project to the remote Supabase project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with the Reference ID noted in step 2. You will be prompted for your database password.

---

## 4. Apply Database Migrations

Push all migrations from the `supabase/migrations/` folder to your remote database:

```bash
supabase db push
```

**Alternative — manual SQL editor:**

If `db push` fails or you prefer manual control:

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) > your project > **SQL Editor**.
2. Open each file inside `supabase/migrations/` in chronological order (files are prefixed with a timestamp).
3. Paste the contents into the SQL editor and click **Run**.

After applying migrations, verify the tables exist under **Table Editor** in the dashboard.

---

## 5. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in every value:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Auth (if using magic links or OAuth)
# NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Vercel (optional — only needed for webhook integration)
VERCEL_WEBHOOK_SECRET=your-webhook-secret
```

> **Security note:** Never commit `.env.local` to version control. The `.gitignore` already excludes it; do not remove that rule.

---

## 6. Generate TypeScript Types (optional but recommended)

Keep your TypeScript types in sync with the database schema by auto-generating them from Supabase:

```bash
supabase gen types typescript --project-id YOUR_PROJECT_REF > types/database.ts
```

Re-run this command any time you apply new migrations. The generated file is imported throughout the codebase as:

```ts
import type { Database } from '@/types/database'
```

---

## 7. Run the Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

Useful scripts:

| Command | Description |
|---|---|
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start the production build locally |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript compiler check |

---

## 8. Deploy to Vercel

Install the Vercel CLI:

```bash
npm install -g vercel
```

Log in:

```bash
vercel login
```

Deploy:

```bash
vercel
```

Follow the prompts to link or create a Vercel project. For production:

```bash
vercel --prod
```

**Set environment variables in Vercel:**

1. Open your project at [vercel.com/dashboard](https://vercel.com/dashboard).
2. Go to **Settings > Environment Variables**.
3. Add every variable from `.env.local` (except `NEXT_PUBLIC_APP_URL` — set this to your production domain).
4. Redeploy the project for the new variables to take effect.

---

## 9. Configure the Vercel Webhook (optional)

This enables the app to automatically track deployment status (created, ready, failed).

**In the Vercel dashboard:**

1. Open your project > **Settings > Webhooks**.
2. Click **Add Webhook**.
3. Set the URL to:
   ```
   https://your-app.vercel.app/api/webhooks/vercel
   ```
4. Select the following events:
   - `deployment.created`
   - `deployment.ready`
   - `deployment.error`
5. Copy the generated **Signing Secret** and add it to your environment variables (both locally and in Vercel):
   ```env
   VERCEL_WEBHOOK_SECRET=your-signing-secret
   ```
6. Redeploy for the secret to be picked up.

The webhook handler at `app/api/webhooks/vercel/route.ts` verifies the signature and updates the corresponding deployment record in Supabase.

---

## Database Tables Overview

| Table | Purpose |
|---|---|
| `profiles` | Extends Supabase Auth users with display name, avatar URL, and role assignments |
| `projects` | Top-level containers for review work; each project has an owner and a set of members |
| `project_members` | Junction table linking users to projects with a specific role (`owner`, `admin`, `reviewer`, `viewer`) |
| `reviews` | Individual review requests attached to a project; stores title, description, status, and the submitter |
| `review_comments` | Threaded comments on a review; supports inline positional comments and general comments |
| `review_attachments` | Files or URLs attached to a review (stored in Supabase Storage or as external links) |
| `handoffs` | Formal handoff records created when a review is approved; captures handoff notes and recipient |
| `deployments` | Deployment records synced via the Vercel webhook; linked to a review or handoff |
| `activity_log` | Append-only audit trail of all significant actions across projects, reviews, and handoffs |

---

## Role Permissions Matrix

| Action | Owner | Admin | Reviewer | Viewer |
|---|:---:|:---:|:---:|:---:|
| View project | Yes | Yes | Yes | Yes |
| View reviews | Yes | Yes | Yes | Yes |
| Submit a review | Yes | Yes | Yes | No |
| Add comments | Yes | Yes | Yes | No |
| Approve / request changes | Yes | Yes | Yes | No |
| Create handoff | Yes | Yes | No | No |
| Manage project members | Yes | Yes | No | No |
| Edit project settings | Yes | Yes | No | No |
| Delete reviews or comments | Yes | Yes | No | No |
| Delete the project | Yes | No | No | No |
| Transfer ownership | Yes | No | No | No |

---

## Architecture Overview

```
review-handoff-system/
├── app/                  # Next.js 14 App Router — pages and API routes
│   ├── (auth)/           # Auth group: sign-in, sign-up, magic-link
│   ├── (dashboard)/      # Protected dashboard routes
│   ├── api/              # API route handlers (server-side only)
│   │   └── webhooks/     # Vercel webhook receiver
│   └── layout.tsx        # Root layout with Supabase session provider
├── components/           # Shared React components
│   ├── ui/               # Headless / primitive UI components
│   └── review/           # Domain-specific components (ReviewCard, CommentThread, etc.)
├── lib/
│   ├── supabase/         # Supabase client helpers (browser + server + admin)
│   └── utils/            # Shared utility functions
├── hooks/                # Custom React hooks (useReview, useProject, etc.)
├── types/
│   └── database.ts       # Auto-generated Supabase TypeScript types (step 6)
├── supabase/
│   └── migrations/       # SQL migration files applied via `supabase db push`
└── public/               # Static assets
```

**Tech stack:**

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (magic link + OAuth) |
| Storage | Supabase Storage |
| ORM / query | Supabase JS client (typed) |
| Deployment | Vercel |
| Webhook | Vercel Deploy Hooks → `/api/webhooks/vercel` |

**Request flow:**

1. The browser calls Next.js server components or API routes.
2. Server components use the **server-side Supabase client** (with the user's session cookie) so Row Level Security (RLS) is enforced automatically.
3. API routes that need elevated privileges (e.g. webhook handler) use the **service-role client** and perform their own authorization checks.
4. All mutations are written to Supabase Postgres and simultaneously append a record to `activity_log`.

---

## Troubleshooting

### `supabase link` fails with "Invalid project ref"

- Confirm the Reference ID from **Project Settings > General** — it is the string of letters and numbers in your project URL (e.g. `xxxxxxxxxxxx` in `https://xxxxxxxxxxxx.supabase.co`).
- Make sure you are logged in with `supabase login` before running `link`.

### `supabase db push` reports permission errors

- You may have entered the wrong database password during `supabase link`. Re-run `supabase link --project-ref YOUR_PROJECT_REF` and provide the correct password you set when creating the Supabase project.
- If you have forgotten the password, reset it under **Project Settings > Database > Reset database password**.

### Environment variable not found at runtime

- Next.js only exposes variables prefixed with `NEXT_PUBLIC_` to the browser bundle. Server-only secrets (e.g. `SUPABASE_SERVICE_ROLE_KEY`) must not have that prefix and are only accessible in server components and API routes.
- After editing `.env.local`, restart the development server (`Ctrl+C` then `npm run dev`).

### TypeScript errors after a new migration

- Regenerate the types file (step 6) and restart the TypeScript language server in your editor.

### Webhook signature verification fails (401)

- Confirm that `VERCEL_WEBHOOK_SECRET` in your environment matches the **Signing Secret** shown in Vercel under **Settings > Webhooks**.
- Ensure the variable is set in the Vercel dashboard for the production environment and that the project has been redeployed since adding it.

### Row Level Security (RLS) blocks queries unexpectedly

- Open the Supabase dashboard > **Authentication > Policies** and verify that the migration applied the correct RLS policies for each table.
- When testing from the SQL editor, remember that the editor runs as the `postgres` superuser and bypasses RLS — use the **API** tab or your app to test policies accurately.

### `npm run build` fails with type errors in `types/database.ts`

- The generated file may be out of date. Re-run:
  ```bash
  supabase gen types typescript --project-id YOUR_PROJECT_REF > types/database.ts
  ```
- Commit the updated file before deploying.
