# Navaro CRM

A focused CRM for Navaro, an import-export and global trade business: leads, clients and user management.

Next.js 14 (App Router) · TypeScript (strict) · Tailwind CSS · MongoDB (Mongoose) · deployed on Vercel.

## Local setup

```bash
cp .env.example .env.local   # fill in MONGODB_URI, JWT_SECRET, SEED_SUPERADMIN_*
npm install
npm run brand:prepare        # only needed once, or after assets/brand-source/ changes
npm run seed                 # creates the first superadmin
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the `SEED_SUPERADMIN_*` credentials.

To also load a small set of fictional demo leads/clients:

```bash
npm run seed:demo
```

`--demo` refuses to run when `NODE_ENV=production`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | `next lint` |
| `npm test` | Run the vitest suite (spins up an in-memory MongoDB replica set) |
| `npm run seed` | Idempotent: creates the first superadmin if none exists, syncs indexes |
| `npm run seed:demo` | Additionally seeds fictional demo leads/clients (dev only) |
| `npm run db:sync-indexes` | Runs `syncIndexes()` on every model |
| `npm run brand:prepare` | Regenerates `public/brand/*` and the app icons from `assets/brand-source/` |

## Environment variables

See `.env.example`. `MONGODB_URI` and `JWT_SECRET` (≥32 chars) are required to run at all; `APP_URL` is required in production (used to build links in outgoing email); `RESEND_API_KEY`/`EMAIL_FROM` are optional — lead-assignment email is skipped entirely when `RESEND_API_KEY` is unset. The `SEED_SUPERADMIN_*` vars are read only by `npm run seed`, never at runtime.

## Role and permission model

Three roles: `superadmin`, `admin`, `member`.

- **Permissions** are explicit strings on each user: `leads.{view,create,edit,delete}`, `clients.{view,create,edit,delete}`, `users.{view,create,edit,delete}`. A user needs *any one* of the permissions a route/page asks for.
- **Superadmin** permissions are inherent — never stored, always pass every check — and only a superadmin may create, edit, promote/demote, or set the permissions of another superadmin. The last active superadmin can't be demoted or deactivated.
- **Admin** and **member** both default to `leads.*` + `clients.*`; a role change resets permissions back to that role's defaults. A superadmin may hand a `member`/`admin` a custom permission set at creation, or edit it later from the Permissions modal in User management.
- Non-admins are auto-assigned as the owner (`assignedTo` on leads, `accountManager` on clients) when they create a record, and cannot reassign a record to someone else.
- Enforcement happens twice: `middleware.ts` (Edge) checks the session cookie's signature/expiry and redirects unauthenticated requests; every route handler and server page additionally calls `requireUser`/`requirePermission`, which reloads the user from the database and checks `isActive` and `tokenVersion`. The UI hides actions a user can't perform, but the server is what actually enforces it.

## Brand asset pipeline

`assets/brand-source/` holds the raw logo PNGs supplied by the brand guide (opaque, off-white background, no transparency). `scripts/prepare-brand-assets.ts` keys that background out to alpha, trims to the artwork bounding box, re-pads with the brand's clearspace rule, and writes the processed files to `public/brand/` plus `app/icon.png`/`app/apple-icon.png`. Re-run `npm run brand:prepare` and commit the output whenever the source files change. `navaro-logo-vertical.png` is a known-broken asset (cropped wordmark) and is never read by the script or referenced anywhere in the app.

## Deploying to Vercel

1. Set `MONGODB_URI`, `JWT_SECRET`, `APP_URL` (and optionally `RESEND_API_KEY`/`EMAIL_FROM`) as environment variables.
2. From a trusted machine with `MONGODB_URI` pointed at production, run `npm run db:sync-indexes` and `npm run seed` once.
3. Deploy. Every mutating API route runs on the Node runtime (`export const runtime = 'nodejs'`); only `middleware.ts` runs on Edge, and it only imports `jose` + `next/server`.

## Open inputs (flagged, not blocking)

- **Utendo web font files and licence** are not included in the brand kit. Until `public/fonts/Utendo-{Light,Regular,Medium}.woff2` are added, the app ships the documented Poppins fallback via a single `--font-brand` CSS variable — swapping in Utendo later is a one-line change in `app/layout.tsx`.
- **Vector/SVG logos and single-colour or dark-background logo files** are not included, and the supplied vertical-stack PNG is cropped. Until official replacements arrive, the logo appears only in full colour on white or Bridal Heath backgrounds.
- The role set (`superadmin`/`admin`/`member`) and the currency list (`lib/constants.ts`) are each a single constant — confirm both with Navaro before launch.

## Known limitation

Next.js's built-in Image Optimization API has an open AVIF-related advisory as of this build's pinned `next` version (the latest 14.2.x patch — see `package.json`; a full fix requires the Next 15/16 line). The app avoids `next/image` entirely — `components/layout/Logo.tsx` and all other imagery use plain `<img>` — so this surface isn't in use, but it's worth re-checking on the next Next.js upgrade.
