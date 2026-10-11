# Verification performed

Verified on 2026-10-08. A hosted first-admin attempt reported by the user exposed an Auth provisioning timing bug: custom app metadata arrives after the Auth user INSERT. The correction was tested against that transaction ordering in PostgreSQL; retrying bootstrap on the hosted project is still required. Hosted Edge Function deployment and Cloudflare delivery have not been tested. Finish the included live-project acceptance checklist before entering production data.

## Database: 35 checks passed

All setup and repair SQL files executed in PostgreSQL through PGlite 0.5.8 with pgcrypto. The harness simulates Supabase's `auth.users`, JWT subject and database roles and executes the actual supplied RLS policies, functions and triggers. It covers:

- Auth Admin API INSERT followed by app metadata UPDATE provisions profiles at commit; forged user metadata and unprovisioned signups roll back. Repair migration is repeatable and was tested on both original and corrected SQL 03.
- Temporary-password read blocking and verified distinct password change; rehashing the same temporary password cannot bypass the flag.
- Read-only viewer and anonymous restrictions; profile self-promotion and non-admin profile-audit reads denied.
- Own-draft marketing writes, confirmation lock, another marketer's ownership restriction and required/optional fields.
- Pre-acknowledgement production denial and server-recorded acknowledgement identity/time.
- Flexible repeated processes, process edits/deletions with retained audit, backward stages/reasons and stale status rejection.
- Role-specific inspection/warehouse writes, skipped processes, inspection arithmetic, positive meters and valid process dates; NULL password and NaN meter boundary cases.
- Independent dashboard totals with multiple child rows, terminal-order restrictions and admin reopening.
- Immediate deactivation and live role changes under an existing JWT identity; atomic temporary resets; self-deactivation protection.
- Audit append-only restrictions.

Reproduce locally from the project root if Node/npm is installed:

```bash
npm install --no-save --package-lock=false @electric-sql/pglite@0.5.8
node tests/database.mjs
```

This is optional testing only; it is not a frontend installation or build requirement. It never contacts or alters a real Supabase project. Delete `node_modules` afterward if desired; it is ignored by Git.

## Browser: 34 checks passed

Executed in Chromium at desktop and 390px mobile widths, with mocked Supabase network responses. Browser tests verified rendering and connected handlers, not hosted Auth behavior:

- Dashboard counts, filters/reset, filtered CSV and full trace CSV downloads.
- Order creation with optional fields omitted.
- Each operational entry form; process edit/delete confirmation; manual status changes.
- Fabric/process/customer add, edit and deactivate controls.
- Admin create-user, change-role, password-reset and activation controls; empty login activity state.
- Relevant role screens and non-admin direct admin-route denial for six staff roles.
- Forced password screen/navigation blocking and return after password save.
- Mobile menu and page-overflow check; wrong-credential feedback and username routing.

Screenshots were inspected for layout. An issue with duplicate field IDs across a page and its dialogs was found and corrected; a subsequent full run passed.

## Edge Function: 15 checks passed

The TypeScript source was transpiled successfully and its handler executed in a Deno-compatible test harness with mocked Supabase Admin APIs. Tests covered missing/invalid JWT, non-admin/inactive/temporary-password callers, origin restrictions, CORS preflight, invalid username/short password, trusted synthetic-account provisioning, omission of passwords from audit, atomic reset payload, guarded role RPC, correct ban/activation ordering and fail-closed database access on simulated ban failure.

This is not a `deno check` or hosted Edge runtime test. The actual function still needs deployment and the user-management checks in the live checklist.

## Source checks

All ES modules and the bootstrap script passed Node syntax checks. HTML local asset references resolve. Required tables, RLS enablement, the security-invoker dashboard view and public configuration were checked. Run `node scripts/check.mjs` (no dependencies) from this folder to repeat these checks.

## David Whitehead Textiles branding — 2026-10-10

- Original supplied PNG retained byte-for-byte in `assets/company-logo.png`; large sign-in logo and compact app header logo.
- Gold/charcoal/white branding with light backgrounds, muted gold navigation and buttons, and distinct status colours.
- Source checks passed. Browser checks passed at 320, 390, 760, 768 and 1280 pixels: both logos load, no horizontal page overflow or header overlap, login error feedback, mobile menu and sidebar positioning.
- Logo home links checked for all seven roles; forced password change remains enforced. No browser JavaScript errors. These checks used a mocked Supabase API and made no live database changes.
- Normal-text contrast ratios checked for primary buttons, active navigation and links: 5.65:1, 6.86:1 and 6.89:1.

## Compact search and filter controls — 2026-10-10

- Dashboard, Orders and Reports keep PO search visible and start with advanced filters collapsed. The Filters button shows the active count; closing preserves values and Escape closes the panel with focus returned to the button.
- Production, Inspection, Warehouse, all three master lists and Users use compact search bars with clear controls and result counts. Login activity keeps its user dropdown visible and collapses event/date filters.
- Browser checks passed for all 11 list screens at 320, 390, 768 and 1280 pixels: compact height, search/clear, combined filters, retained values, sorting, date-range feedback, filtered CSV downloads and no horizontal page overflow. No browser JavaScript errors.
- All 34 existing browser regression checks passed against the changed sources, including entry forms, order creation, process edit/delete, status changes, master/user management, role routing and forced password change.
- Source checks passed with `node scripts/check.mjs`. Browser checks used mocked Supabase responses; no live database changes were made. No SQL or Edge Function changes are required for this update.

## Persistent navigation highlight and console investigation — 2026-10-10

- Reproduced the reported bug: one active navigation link before a focus-triggered identity check, zero afterwards. The account check rebuilt every menu link without restoring the active state.
- Menu links now rebuild only when role/password-state permissions change. Active styling and `aria-current` follow the current route, including order-detail parent screens. Unchanged account checks preserve the existing links and keyboard focus.
- Browser checks passed for 13 admin routes (including all master tabs and order details), focus events and repeated 30-second identity callbacks. Six staff roles passed mobile navigation and order-detail parent highlighting. Live role changes remove admin routes and redirect to the permitted home; live temporary-password resets clear navigation and force the password screen.
- Tested with the actual pinned Tailwind 3.4.17 CDN script and the supplied Cloudflare CSP, with mocked Supabase responses: zero application errors, CSP violations or font requests. Tailwind's own development-CDN advisory remains. The reported font and message-channel errors were not reproduced in this clean browser; they appear to come from an extension or another injected resource. The app's CSP was not widened to allow unknown font sources.
- All 34 existing browser regression checks and `node scripts/check.mjs` passed. No live Supabase data was changed, and no SQL or Edge Function changes are required.

## Session recovery and section refreshes — 2026-10-10

- Fixed `profile()` treating every Auth error as a missing session. It now preserves the session on transient network, 429 and 5xx failures, shares overlapping verification requests, retries access-token renewal once when appropriate, and distinguishes confirmed expiry/revocation/bans. The existing inactive-profile and temporary-password restrictions remain enforced. No server session settings were changed.
- Removed full-route rendering from mutation callbacks. Dashboard/Orders/Reports, all work lists, master lists, Users and Login activity refresh their data regions while keeping search/filter controls and the screen shell. Order traces refresh the affected entry table and its related summary/progress/audit regions; order edits and stage changes refresh the corresponding information and history. Responses from older refreshes or abandoned routes cannot overwrite current data.
- A successful mutation followed by a failed read closes the saved form, reports the saved state and offers recovery via the local Refresh button. Follow-up read errors do not invite duplicate submissions.
- Fixed a duplicate input/change event rendering the table on search blur and swallowing the first click on a table action.
- 29 targeted Chromium checks passed with controlled Supabase faults: offline/retryable/server/rate-limit Auth errors, access-token renewal and recovery, shared checks, terminal session cases and inactive sign-out; all five trace entry types, process edit/delete, status/history updates, scoped trace reads, committed-write/read-failure recovery, every list's mutation/refresh behaviour, filter and shell preservation, vertical/horizontal scroll preservation and stale-response protection. No browser JavaScript errors.
- The existing 34 browser regressions passed. Compact controls passed across all 11 list screens at 320, 390, 768 and 1280 pixels. Navigation persistence/role-change/password-reset tests passed with the real Tailwind runtime and supplied CSP. Source checks passed. Tests used mocked Supabase responses and made no live database changes. No SQL or Edge Function update is required.

## User-management browser requests — 2026-10-11

- Read-only probes against the configured hosted `admin-users` function returned HTTP 403 `{"error":"Origin not allowed"}` for browser preflights with a Pages origin and localhost. A preflight without Origin returned 204. The live function was reachable, but rejected browser-origin requests before Auth/user creation. These probes did not submit any staff credentials or mutate data; the user's exact deployed Pages origin was not available.
- The revised handler answers OPTIONS first and includes CORS headers on every response. Default CORS is bearer-authenticated and independent of the frontend domain; existing origin secrets are ignored unless `ENFORCE_ALLOWED_ORIGINS=true` is deliberately enabled. Optional restrictions remain enforceable and report readable errors. JWT verification, live active-admin/password-state checks, trusted provisioning and restricted profile RPCs remain intact.
- Added a read-only, admin-authorized `status` action and Users → Check connection to confirm version `2026-10-11-cors`. The frontend obtains the session JWT explicitly and renews near-expiry tokens before submitting; renewal failure sends no admin action. Gateway, missing-function, handler validation and ambiguous transport errors now have distinct messages. Writes are never automatically replayed after a fetch/relay failure.
- `node tests/admin-users.mjs` passed 15 grouped checks (Node 24+, no packages): CORS, read-only status, JWT/role/state denials, creation across domains, validation, trusted metadata/audit, atomic resets, guarded role changes, fail-closed bans, optional restrictions and frontend session/error handling. The actual TypeScript is stripped and executed with mocked Auth Admin APIs. This is not a hosted Auth integration test.
- Five Chromium integration checks passed using the actual handler on a separate local HTTP origin with mocked Auth and an SDK shim issuing explicit OPTIONS/POST requests: version check with no mutation, readable gateway rejection with form retained, successful create and local filtered-directory refresh, XSS escaping/mobile layout, and old preflight failure with an explicit redeployment message. No application JavaScript errors. The shim simulates browser refusal of a rejected preflight; this does not verify the hosted site's CORS configuration.
- All 34 existing browser regressions and source checks passed. No SQL changes were made. The revised Edge Function still must be deployed to Supabase separately from the GitHub/Cloudflare frontend; hosted staff creation after that deployment remains to be checked.

## Named order actors and readable audit — 2026-10-11

- Replaced technical table/action rows with Created/Updated/Deleted business labels, full name + username, and exact date/time including seconds and timezone. The identity is visible while collapsed. Expand to see only business fields that changed in a before/after table; original audit JSON and deleted values are preserved. Newest audit events appear first.
- Order creator/acknowledger, status-history actors and entry Recorded by / Recorded at columns also resolve names. Full trace CSV retains original UUIDs and raw values and adds human-readable actor columns. Partial refreshes retain expanded audit events.
- Added the read-only `get_order_actor_names` function in SQL 03 for new installs and idempotent SQL 06 for existing installs. It returns only ID/username/full_name for actors linked to the requested order. Existing profiles RLS is unchanged. Active-user/password-change restrictions apply; anonymous execution is revoked. Historical actors remain named after deactivation, without letting inactive callers use the lookup.
- 41 database checks passed in PGlite with simulated Supabase Auth roles, including repeated migration, all seven active roles, unrelated/unknown-order exclusion, minimal returned fields, unchanged profile access, inactive/temporary-password denials and historical inactive actor names. Existing Auth/RLS/order-flow checks also passed.
- Eight dependency-free audit renderer checks passed: actor/system/unknown distinctions, metadata exclusion, null versus zero, reference/calendar labels, exact seconds/timezone, delete snapshots, newest-first ordering, original records, HTML escaping and empty states.
- Nine targeted Chromium checks passed with mocked Auth/database and the real Tailwind runtime: collapsed identity/time, changed fields, deletion values, named order/history/entries, local edit refresh and open-state preservation, named trace CSV, safe missing-migration fallback/recovery, 320/390/768px layout and no application errors. Desktop/mobile screenshots were visually inspected.
- All 34 existing browser regressions, all 29 session/partial-update checks and source checks passed. No live database writes were made. The existing Supabase installation needs SQL 06; the frontend changes are delivered through GitHub/Cloudflare. No Edge Function changes are included in this update.
- Name labels use current profile identities; immutable actor IDs remain available in original records/CSV. Timestamps use the browser's timezone, explicitly displayed. Hosted role testing after applying SQL 06 remains to be verified.
