# Code Review: Schedule Import Feature

**Scope:** Schedule import (parser, service, user + admin API/UI), related models and migrations.  
**Date:** 2026-03 (post-implementation).

---

## Summary

The implementation is solid and matches the agreed design. A few small fixes were applied; the rest are documented as potential improvements or future considerations.

---

## Fixes Applied

1. **Unused import** – Removed `Illuminate\Support\Facades\Validator` from `App\Http\Controllers\Api\ScheduleImportController` (never used).
2. **Admin CSV MIME check** – In `Admin\ScheduleImportController::getCsvContent()`, the `csv` file input now validates MIME type (same as `file`) so non-CSV uploads are rejected.

---

## Issues / Risks (current or future)

### 1. Parser: year for dates

- **Where:** `ArisExpandedScheduleCsvParser::buildDateMap()` uses `$year = (int) date('Y')`.
- **Issue:** For a CSV that spans Dec 2025–Jan 2026, all dates are interpreted with the current calendar year. If the file is imported in January 2026, December would get 2026 instead of 2025.
- **Suggestion:** Prefer inferring year from the CSV (e.g. title line “17-Mar-26 to 31-Jul-26”) or from the first month name + current date (e.g. if you see “Dec” and today is Jan, use previous year for Dec). Optional: allow a year hint in the UI/API.

### 2. No CSV size limit

- **Where:** Both API and Admin controllers call `$file->get()` with no size check.
- **Issue:** Very large files can exhaust memory or hit `upload_max_filesize`/`post_max_size` with a generic error.
- **Suggestion:** Reject uploads over a limit (e.g. 5–10 MB) with a clear message, and/or stream/parse in chunks if you need to support large files later.

### 3. SwapPost “active” status

- **Where:** `ScheduleImportService::applyForUser()` uses `whereIn('status', ['open', 'pending'])` to detect shifts with “active” posts.
- **Issue:** In this codebase, SwapPost statuses appear to be `open`, `closed`, `cancelled`, `expired`. `pending` is used on **offers**, not posts. Including `pending` is harmless but redundant.
- **Suggestion:** Use only `'open'` for clarity, unless you introduce a “pending” post status later.

### 4. Admin bulk apply: partial failure

- **Where:** `Admin\ScheduleImportController::bulkApply()` loops over users and calls `applyForUser()` per user with no transaction across users.
- **Issue:** If one user’s apply throws (e.g. DB error), previous users’ runs and shifts are already committed. You get partial success.
- **Suggestion:** Either document “best effort per user” or wrap each user’s apply in `DB::transaction()` so each user’s run is atomic. A single global transaction for the whole bulk run would be heavy and could lock for a long time.

### 5. Missing-shifts “required action” UI

- **Where:** Design called for surfacing shifts that exist on the user’s board but not in the import (“missing”) as a required action (confirm keep vs delete). Backend stores `missing_shift_ids` in run meta and returns them in the apply response.
- **Issue:** There is no dedicated UI for the user (or admin) to resolve these (e.g. “Reconcile missing shifts” list with keep/delete). The dashboard doesn’t yet surface “you have N shifts not in your last import.”
- **Suggestion:** Add a small “Required action” or “Reconcile shifts” section (e.g. on dashboard or import page) when `missing_shift_ids` is non-empty after an import, with the option to remove those shifts (and only if they have no active post).

### 6. Unmapped codes never cleared

- **Where:** `schedule_unmapped_codes` is only written to when an unmapped desk/time is seen.
- **Issue:** After an admin adds a position range that covers a code, that code stays in `schedule_unmapped_codes` forever unless you add a “clear”/“dismiss” or “remap” flow.
- **Suggestion:** Optional: allow “dismiss” or “cleared” for a code in the Unmapped Codes admin page, or a job that deletes codes that now match a range (more complex).

### 7. Doubles / same start time

- **Where:** Matching is by `user_id` + `start_time_utc`. One shift per (user, start_time_utc).
- **Issue:** If the CSV had two rows for the same user, same date, same time code (e.g. duplicate line), the second would match the first and update it instead of creating a second shift. Real “doubles” (e.g. 06 and 14 on the same day) have different start times, so they correctly create two shifts.
- **Suggestion:** No change required unless you need to support two distinct shifts with the same start time; then you’d need an extra discriminator (e.g. sequence, or desk_code) in the match.

---

## Not broken / working as intended

- **User with no workgroup:** Correctly skips rows and records reason; no attempt to create a shift with `workgroup_id` 0.
- **Conflict (shift has active post):** Correctly skips update and records conflict; no overwrite of shifts with open postings.
- **Run and items:** Run is created first; items get `schedule_import_run_id`; run is updated with counts and meta at the end. Consistent.
- **Target vs creator:** `created_by_user_id` (who ran the import) and `target_user_id` (whose schedule) are set correctly for both user and admin modes.
- **Casting:** `ScheduleImportRunItem` shift_date, start_time_utc, end_time_utc casts are correct; Carbon/strings are handled by Eloquent.
- **Leave codes:** Filtering of OFF, VAC, GDO, etc. in `filterLeaveRows()` is consistent with design.
- **Preview response:** Preview strips internal `_resolved`/`_times` before sending to frontend (only in `preview` array; API returns `preview` as built by `previewForUser`, which does include those keys – but the frontend only uses the displayed fields, so no leak). Optional: remove `_resolved` and `_times` from the preview array in the service or controller so they never reach the client.

---

## Dead / unused code

- **Api ScheduleImportController:** `Validator` import – removed.
- **Preview payload:** `_resolved` and `_times` in each preview row are only for internal use; the API still sends them. They’re harmless but could be stripped in `previewForUser()` or in the controller for a cleaner API.

---

## Suggestions for the site (beyond schedule import)

1. **Reconcile missing shifts** – As above, a small flow or dashboard block for “Shifts not in your last import” (from `missing_shift_ids`) with keep/delete.
2. **Training flag** – Design mentioned TRN/ITR as “show on board but not tradable.” If you add `shifts.is_training` (or similar), you can set it when desk/context indicates training and disable trading in the UI for those shifts.
3. **Import history for the user** – Users currently only see the last apply result on the import page. A “Your import history” list (e.g. last 5 runs with date and counts) would help them confirm what was applied when.
4. **Rate limiting** – Consider throttling `schedule-import/preview` and `schedule-import/apply` (and admin bulk) to avoid abuse (e.g. `throttle:10,1` or similar).
5. **File size feedback** – On the import page, if the server returns 413 or a “file too large” message, show a clear message and optionally suggest a max size (e.g. “Max 10 MB” in the label).
6. **Centralize CSRF token** – `getCsrfToken()` is duplicated in several frontend files; consider a small `lib/csrf.ts` or hook so it’s defined once.
7. **Audit report (admin)** – Design mentioned “compare all-users report with what’s on users’ boards.” You could add an admin page that compares a chosen import run (or latest run per user) to current shifts and highlights extra/missing per user.

---

## Checklist (quick reference)

| Item                                      | Status |
|-------------------------------------------|--------|
| Unused Validator import (Api)              | Fixed  |
| Admin CSV file MIME check                 | Fixed  |
| Parser year for Dec/Jan boundary          | Documented; optional fix |
| CSV size limit                            | Suggested |
| SwapPost status 'pending'                  | Optional cleanup |
| Bulk apply transaction per user           | Optional |
| Missing-shifts reconciliation UI           | Not implemented; suggested |
| Unmapped codes clear/dismiss              | Optional |
| Preview strip _resolved / _times           | Optional |
| User import history list                  | Suggested |
| Rate limiting on import endpoints         | Suggested |
| Training flag on shifts                   | From design; suggested |

---

## Explaining #4 (Rate limiting) and #6 (Centralize CSRF)

### #4 Rate limiting
Without rate limiting, anyone who is logged in can call `POST /api/schedule-import/preview` or `POST /api/schedule-import/apply` as often as they want. That can overload the server (parsing and applying large CSVs is CPU- and DB-heavy), fill the DB with many import runs, or be abused by a bot. Laravel’s `throttle` middleware (e.g. `throttle:10,1` = 10 requests per 1 minute per user) limits how many times those endpoints can be called. So #4 is a **safety and stability** measure.

### #6 Centralize CSRF token
`getCsrfToken()` is copy-pasted in several frontend files. That means: duplication, harder maintenance if the cookie name or reading logic ever changes, and the same function in multiple chunks. Putting it in one place (e.g. `lib/csrf.ts`) and importing it everywhere gives a single source of truth. So #6 is a **maintainability** improvement, not a functional fix.
