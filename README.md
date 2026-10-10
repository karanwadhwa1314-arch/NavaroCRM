# Navaro CRM

A focused CRM for Navaro, an import-export and global trade business: leads, clients, projects, broadcasts and user management.

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

- **Permissions** are explicit strings on each user: `leads.{view,create,edit,delete}`, `clients.{view,create,edit,delete}`, `projects.{view,create,edit,delete}`, `users.{view,create,edit,delete}`. A user needs *any one* of the permissions a route/page asks for.
- **Superadmin** permissions are inherent — never stored, always pass every check — and only a superadmin may create, edit, promote/demote, or set the permissions of another superadmin. The last active superadmin can't be demoted or deactivated.
- **Admin** and **member** both default to `leads.*` + `clients.*` + `projects.*`; a role change resets permissions back to that role's defaults. A superadmin may hand a `member`/`admin` a custom permission set at creation, or edit it later from the Permissions modal in User management.
- Non-admins are auto-assigned as the owner (`assignedTo` on leads, `accountManager` on clients, `projectManager` on projects) when they create a record, and cannot reassign a record to someone else.
- Enforcement happens twice: `middleware.ts` (Edge) checks the session cookie's signature/expiry and redirects unauthenticated requests; every route handler and server page additionally calls `requireUser`/`requirePermission`, which reloads the user from the database and checks `isActive` and `tokenVersion`. The UI hides actions a user can't perform, but the server is what actually enforces it.

## Brand asset pipeline

`assets/brand-source/` holds the raw logo PNGs supplied by the brand guide (opaque, off-white background, no transparency). `scripts/prepare-brand-assets.ts` keys that background out to alpha, trims to the artwork bounding box, re-pads with the brand's clearspace rule, and writes the processed files to `public/brand/` plus `app/icon.png`/`app/apple-icon.png`. Re-run `npm run brand:prepare` and commit the output whenever the source files change. `navaro-logo-vertical.png` is a known-broken asset (cropped wordmark) and is never read by the script or referenced anywhere in the app.

## Individual and company leads

A lead is either an **individual** (a person, optionally at a company) or a **company** (an organisation with no person's name). Both live in the one `leads` collection, so stages, activities, assignment, conversion to a client, search and broadcasts work the same for both; `Lead.leadType` (`'individual'` default, `'company'`) tells them apart, and company leads leave `firstName`/`lastName` blank. Documents saved before the field existed have no value and count as individuals (`typeFilter()` in `services/leads.ts`). The Leads page has a large Individuals / Companies switch (`?type=company`) with counts. A company lead converts to a client with no contact person (its email/phone go into the client's notes). The type can't be changed after creation.

**CSV import** (up to 5,000 rows, 2 MB): every row needs an Email and a Phone, plus a person's name (First name + Last name, or one "Contact person"/"Name" column) or a Company name. `lib/lead-import.ts` decides what each row is: a person's name makes an individual (the company is where they work; a single-word name is stored as a first name only; ALL-CAPS / all-lowercase names are tidied to Title Case); a company name with no person, or a contact cell that is clearly a business (Pvt Ltd, Logistics, …), makes a company lead. A contact cell that just repeats a person-style name is a person (sole proprietors). Designation → job title, Segment → a tag, Note → notes; other columns are ignored. Duplicates (same email as an active lead, or earlier in the file) are skipped. The preview shows how many people vs companies were found and how the first rows were read.

## Projects

Client work, tracked as projects made of **cards** (sidebar → Projects). Permissions are `projects.view/create/edit/delete`; they are in the admin/member defaults, but users created before the module existed keep the permission set stored on them, so a superadmin grants `projects.*` from Users → Permissions (superadmins always have it). Full details, and how this maps to the Flare CRM reference, are in [`docs/PROJECTS_MODULE.md`](docs/PROJECTS_MODULE.md).

- **Naming:** a project's name is `<Client-name>-<Motive>` (the client's company name with spaces → hyphens, plus a motive of at least 3 letters) and its code is `<CLI>-<MOT>-<nnn>` (3 letters from the client, 3 from the motive, running number). Names are unique among active projects (case-insensitive). The code is issued once and never changes, even if the motive is edited.
- **Lifecycle:** `planning → in progress → on hold → review → completed / cancelled`. **End project** sets `completed`, stamps the end date and makes the project, its cards and team read-only until **Restart project** (which reopens it as in progress).
- **Cards:** To do / In progress / Done, each with at least one assignee drawn from the project's team or its project manager. Moving to In progress needs a deadline; a Done card can't be edited; cards can repeat daily, weekly or monthly (finishing one creates the next). Done cards are deleted after 10 days.
- **Health:** every project starts at 100%. Each unfinished card past its deadline costs 5%, plus 5% for every further full day overdue (floor 20%). At the floor no new cards can be added. Levels: perfect (100), good (80+), average (40+), critical. The projects list is ordered least healthy first by default.
- **Team:** people with a role per project. Someone still on open cards can't be removed from the team; reassign their cards first.
- **Deleting:** a superadmin deletes the project and its cards; anyone else archives it (hidden, status cancelled, name reusable). A client that still has projects can't be hard-deleted.
- **Card assignment email:** each newly assigned person gets an email (skipped when `RESEND_API_KEY` is unset, and never sent to yourself).
- **Clean-up job:** `.github/workflows/project-card-cleanup.yml` calls `GET /api/cron/project-cards` daily (Bearer `CRON_SECRET`, the same secret and `APP_URL` repository secrets as the broadcast scheduler) to delete Done cards older than 10 days.
- **Indexes:** run `npm run db:sync-indexes` once after deploying (new `projects` and `projectcards` collections).

## Broadcasts

Email every active lead in the CRM, now or on a schedule (sidebar → Broadcasts). Permissions are `broadcasts.view/create/edit/delete/send`; they are **not** part of the admin/member defaults — a superadmin grants them from Users → Permissions. Scheduling or sending requires `broadcasts.send`.

- **Sender:** `RESEND_FROM_EMAIL` (default `karan@navaro.co.in`) and `RESEND_FROM_NAME`. The domain must be verified in Resend.
- **Audience:** `resolveAudience()` in `services/broadcasts.ts` — active leads (any stage) with a valid email; duplicate addresses collapse to one. The audience is frozen into `BroadcastDelivery` rows when sending starts, so leads added mid-send are not included.
- **Sending:** Resend's batch API, 100 per call, with an idempotency key per chunk, a lease so two workers never send the same broadcast, and per-address rejection handling. Quota/rate/provider errors pause and resume automatically; configuration errors (bad key, unverified domain) mark the broadcast **Failed** and **Retry** resumes it.
- **Attachments:** up to 5 files per broadcast, 400 KB each (PDF, images, Word/Excel/PowerPoint, TXT, CSV; no executables or HTML/SVG). Limits live in `lib/broadcast-attachment-rules.ts` and are re-checked on the server, including that the file's content matches its extension. Bytes are stored in the `BroadcastAttachment` collection (run `npm run db:sync-indexes` once after deploying), are editable only while the broadcast is a draft/scheduled, and are deleted with it. Resend's batch endpoint can't carry attachments, so a broadcast with files is sent one request per recipient (4 at a time, ~1s apart, each with its own idempotency key). That is slower than the 100-per-call batches: roughly 150 recipients per scheduler tick, the rest on the following ticks.
- **Scheduling:** the schedule lives in MongoDB. Vercel has no always-on server, so `.github/workflows/broadcast-scheduler.yml` calls `GET /api/cron/broadcasts` every 5 minutes (Bearer `CRON_SECRET`). A scheduled broadcast goes out at the first tick at or after its time (up to ~5 min late). On Vercel Pro you can use Vercel Cron instead by adding a `vercel.json` with `{"crons":[{"path":"/api/cron/broadcasts","schedule":"* * * * *"}]}` and setting `CRON_SECRET` in Vercel (Vercel sends it automatically); Hobby plans only allow daily cron, which is why the default is GitHub Actions.
- **Merge field:** `{{first_name}}` (falls back to "there"). Nothing else is personalised yet.
- **Not built (by design):** unsubscribe management, segmentation, open/click tracking.

## Deploying to Vercel

1. Set `MONGODB_URI`, `JWT_SECRET`, `APP_URL` (and optionally `RESEND_API_KEY`/`EMAIL_FROM`, and for Broadcasts `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `CRON_SECRET`) as environment variables.
2. From a trusted machine with `MONGODB_URI` pointed at production, run `npm run db:sync-indexes` and `npm run seed` once.
3. Deploy. Every mutating API route runs on the Node runtime (`export const runtime = 'nodejs'`); only `middleware.ts` runs on Edge, and it only imports `jose` + `next/server`.

## Open inputs (flagged, not blocking)

- **Utendo** is self-hosted from `public/fonts/` (`Utendo-Regular.woff2`, `Utendo-Bold.woff2`) via `next/font/local` in `app/layout.tsx`. Only Regular and Bold exist, so Regular serves the 300–500 weights (body and headings) and Bold serves 600+; the brand guide asks for Light body / Medium headings, so add those cuts there if they become available. Broadcast emails declare `@font-face` against `$APP_URL/fonts/`; mail apps that ignore web fonts (e.g. Gmail) use the Poppins/Helvetica fallback. Confirm the font licence covers web and email use.
- **Vector/SVG logos and single-colour or dark-background logo files** are not included, and the supplied vertical-stack PNG is cropped. Until official replacements arrive, the logo appears only in full colour on white or Bridal Heath backgrounds.
- The role set (`superadmin`/`admin`/`member`) and the currency list (`lib/constants.ts`) are each a single constant — confirm both with Navaro before launch.

## Known limitation

Next.js's built-in Image Optimization API has an open AVIF-related advisory as of this build's pinned `next` version (the latest 14.2.x patch — see `package.json`; a full fix requires the Next 15/16 line). The app avoids `next/image` entirely — `components/layout/Logo.tsx` and all other imagery use plain `<img>` — so this surface isn't in use, but it's worth re-checking on the next Next.js upgrade.
