# Projects module: handover

The Projects section was ported from Flare CRM (the functional reference) into Navaro CRM and adapted to Navaro's stack (Next.js 14 App Router, TypeScript, Mongoose, Zod, Tailwind) and brand. Flare's code was **not** copied; its behaviour and business rules were traced through its model, controller, validators, jobs and UI and re-implemented.

## 1. What was inspected in Flare

| Area | Flare files |
|---|---|
| Data | `backend/models/Project.js`, `Card.js` |
| API and rules | `controllers/projectController.js`, `routes/projects.js`, `middleware/validate.js` (project and card schemas) |
| Business helpers | `utils/deadlineHealth.js`, `utils/projectNaming.js`, `utils/scope.js`, `utils/notifications.js`, `utils/emailService.js` (`cardAssigned`) |
| Jobs | `jobs/expireDoneCards.js` + `.github/workflows/cron-expire-done-cards.yml` |
| UI | `pages/Projects.js` (client picker + health summary), `ClientProjects.js` (project list), `ProjectCreate.js`, `ProjectDetails.js` (health, card board, team, details), `components/common/HealthIndicator.js`, `EmployeePicker.js` |
| Dashboard | `dashboardController.getProjectHealth` |

Flare's Project model also carries time entries, budget, documents, repository, quote link and a stored completion percentage. The Flare UI does not expose any of them (budget UI is commented out as "disconnected", time entries have no screen, documents/repository are never shown, completion percentage has no calculation), and Navaro has no quotes module, so none of these were ported.

## 2. Mapping

| Flare | Navaro |
|---|---|
| `models/Project.js` | `models/Project.ts` |
| `models/Card.js` | `models/ProjectCard.ts` (name avoids a generic "Card") |
| `projectController.js` | `services/projects.ts`, `services/project-cards.ts` (Navaro keeps logic in services, thin route handlers) |
| `routes/projects.js` | `app/api/projects/**` via `withRoute` |
| Joi schemas | `lib/validation/project.ts` (Zod) |
| `deadlineHealth.js` | `lib/project-health.ts` |
| `projectNaming.js` | `lib/project-naming.ts` |
| `computeNextOccurrenceDate` | `lib/card-recurrence.ts` |
| `expireDoneCards` job | `services/project-cards.expireDoneCards` + `app/api/cron/project-cards` + `.github/workflows/project-card-cleanup.yml` |
| `cardAssigned` email | `lib/email.cardAssignedEmail` |
| `Projects.js`, `ClientProjects.js` | `app/(app)/projects/page.tsx`, `components/projects/ProjectsClient.tsx` |
| `ProjectCreate.js` | create modal, `components/projects/ProjectForm.tsx` |
| `ProjectDetails.js` | `app/(app)/projects/[id]/page.tsx`, `ProjectDetailClient`, `CardBoard`, `CardFormModal`, `TeamPanel` |
| `HealthIndicator.js` | `components/projects/HealthMeter.tsx` |
| Permissions `projects.*` | same names, in `lib/permissions.ts` |

## 3. Behaviour preserved from Flare

- Project fields: name, code, description, client, status, priority, start date, project manager, team (user + role), tags, notes. Statuses `planning, in_progress, on_hold, review, completed, cancelled`.
- Name `<Client-name>-<Motive>`, code `<CLI>-<MOT>-<nnn>`, motive needs at least 3 letters, names unique (case-insensitive).
- A completed project is read-only; the only allowed change is restarting it.
- Non-admins always own the projects they create.
- Soft delete (archive, status cancelled) for non-superadmins, hard delete for superadmin.
- Cards: To do / In progress / Done; title; description up to 500 characters; optional http(s) file link; deadline; at least one assignee, who must be on the team or be the project manager; In progress requires a deadline; Done cards are immutable and stamped with `doneAt`; recurrence (daily, weekly on chosen weekdays, monthly on a day clamped to short months) spawns the next occurrence, anchored on the completion day, keeping the time of day; Done cards are deleted after 10 days; new assignees are emailed.
- Deadline health: 5% for a missed deadline plus 5% per further 24h, floor 20, new cards blocked at the floor, levels perfect/good/average/critical, projects listed least healthy first, summary counts over planning/in progress/review projects.
- Permissions: `projects.view` to read, `projects.edit` for project, team and card writes, `projects.delete` to delete projects and cards, `projects.create` to create.

## 4. Deviations (and why)

| # | Deviation | Reason |
|---|---|---|
| 1 | One filterable project list instead of "pick a client, then see its projects". The client page also lists its projects and links to `/projects?client=…`. | Removes a forced extra click while keeping the per-client view. |
| 2 | Added filters: client, status, priority, project manager, "My projects" (manager or team), search by name/code/description; sortable columns; per-project card progress ("3 of 8 done"). | Flare's list only filtered by status and search. Progress is derived from cards, no new rule. |
| 3 | A project can be **edited** (motive, description, start date, priority, notes, manager) from its page. | Flare's API supported it but its UI only allowed inline status/priority. |
| 4 | The **code never changes** after issue. Flare re-issued the code whenever the name was edited. | A reference that silently changes is a defect. |
| 5 | `actualEndDate` is set when a project is ended and cleared on restart. | Flare had the field but never wrote it. |
| 6 | Client cannot change after creation. | Name and code are derived from the client. |
| 7 | Code allocation retries on a unique-index collision. | Flare's read-then-write sequence could issue duplicates under concurrent creates. |
| 8 | An in-progress card can't have its deadline cleared (Flare only checked on the move into In progress). | Closes a loophole in the rule Flare intended. |
| 9 | Removing a team member who still has open cards is refused (409). The project manager is exempt as they stay eligible. | Flare left such cards assigned to someone no longer on the project. |
| 10 | Hard-deleting a project also deletes its cards. Hard-deleting a client that still has projects is refused. | Flare orphaned cards, and a project cannot outlive the client its name derives from. |
| 11 | Cards of an ended project cannot be deleted either. | Flare's read-only rule skipped delete. |
| 12 | Team roles are `project_manager, coordinator, sourcing, logistics, compliance, finance, consultant` (Flare: developer, designer, QA, devops…). | Navaro is an import-export business. The set is a suggestion, edit `PROJECT_TEAM_ROLES` in `lib/constants.ts`. |
| 13 | Priorities reuse Navaro's `low/medium/high/urgent` (Flare: `critical`). | Reuses the existing constant and badge, avoids two priority vocabularies. |
| 14 | Team "allocation %" and hourly rate dropped. | Never shown or editable in Flare's UI. |
| 15 | Deadlines use a single date-time input (Flare: date + three selects). | Simpler and accessible. Stored as UTC, shown in the viewer's timezone. |
| 16 | Project activity (created, status change, team change) is shown on the project page; Flare stored it but never displayed it. Writes also go to Navaro's audit log. | Uses data Flare already recorded. |
| 17 | The assignment email is not sent to the person who made the assignment. | Nobody needs an email about their own action. |
| 18 | A card's status/assignee filter is available to everyone ("All / My cards / person"); Flare showed an employee filter to admins and a "My cards" toggle to others. | One consistent control. |
| 19 | No dashboard widget. Flare's `getProjectHealth` summary appears at the top of the Projects page instead. | Avoids redesigning the Navaro dashboard, which was out of scope. |

## 5. Data and migrations

Two new collections, `projects` and `projectcards`; no existing collection changed shape and nothing is migrated or deleted. Run `npm run db:sync-indexes` once after deploying. `AUDIT_ENTITIES` gained `project` (an enum used only when writing new audit rows).

Permissions: the role defaults for new admins/members now include `projects.*`. Users that already exist keep the permission array stored on them, so a superadmin must grant `projects.*` to existing users (Users → Permissions). Superadmins need nothing.

## 6. Brand compliance

Built only from the brand tokens already in `tailwind.config.ts` (`#054742`, `#F9DB5F`, `#3ECEB9`, `#C780ED`, `#FFFAF3`, black, and the derived neutrals plus the semantic red), Utendo via the existing `--font-brand` stack, sentence case throughout, rounded 10/16px controls and cards, no shadows, Lucide medium-stroke icons, the shared Button/Badge/Modal/Table components, and the existing logo components (no logo changes).

- Health uses the data-colour roles: green (primary metric) for perfect, turquoise (growth) for good, yellow (opportunity) for average, semantic red for critical. Health is always shown with a percentage, a word and an icon as well as colour, never colour alone. The bar has no gradients or shadows.
- Status and priority badges reuse the existing solid-fill tones with contrast-checked text pairs.
- Lavender is used for planning/recurring accents only.
- Flare's colours, emoji and company styling were not carried over.

## 7. Tests

`tests/project-logic.test.ts` (health maths and levels, naming, recurrence, validation), `tests/projects.test.ts` (service rules: creation, naming and code allocation, lifecycle, team, cards, recurrence, listing, stats, client interaction) and `tests/project-cards-cron.test.ts` (the clean-up endpoint). `tests/permissions.test.ts` was updated for the new defaults.

## 8. Known limits

- Done-card clean-up needs the GitHub Actions workflow (or any pinger) and the `APP_URL` / `CRON_SECRET` secrets; without them Done cards simply stay.
- The default "least healthy first" order loads all matching projects and their cards to compute health, then pages in memory (as Flare did). Fine for hundreds of projects; if Navaro ever has many thousands, store a cached health value on the project.
- Card writes are not wrapped in a transaction. A failed email never fails a write, by design.
