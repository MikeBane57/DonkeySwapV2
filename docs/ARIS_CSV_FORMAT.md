# ARIS expanded schedule CSV format

This document describes the expected layout of ARIS "Expanded schedule" CSV exports used for schedule import (user and admin). The parser is in `App\Services\ScheduleImport\ArisExpandedScheduleCsvParser`.

## Header block

- The parser finds a line containing **"Name (ID) Qualification"** (case-insensitive).
- The next two rows are the **month row** (e.g. Jan, Feb, Mar) and **day row** (e.g. 1, 2, 3 …).
- A third row (day of week) is read but only the month/day rows are used to build the date map.

So the header is a trio: Name/ID/Qual line, then month abbreviations, then day numbers.

## Name column

- Format: `LastName, FirstName  (EmployeeID) Qual1, Qual2, ...`
- Example: `Bane, Michael  (99917) Asst, Junior Avail, MTRN, SOD, SSOD`
- The parser extracts:
  - **Employee ID** from the parenthesized number.
  - **Employee name** from the text before the `(ID)` (commas/spaces normalized).
  - **Qualifications** from the comma-separated list after the closing parenthesis (e.g. SOD, MTRN). These are stored as `qualifications` on each parsed row; they are not desk codes.

## Per-day cells

- Each calendar day uses **two columns**: first is **time_code**, second is **desk_code**.
- Empty or "OFF" cells are skipped.
- **Doubles** (two shifts on the same day) are represented by a **second data row** for that employee: same month block, but the name/ID cell is empty. The continuation row is read with a column offset so the second shift per day comes from the correct cells.

Example for one employee in March 2026:

- March 7: 0600 S4 and 1400 S4 (double) → two rows emitted: (2026-03-07, 0600, S4) and (2026-03-07, 1400, S4).
- March 19: 1200 TRN → one row: (2026-03-19, 1200, TRN).
- March 29: 0600 S1 and 1400 S1 (double) → two rows: (2026-03-29, 0600, S1) and (2026-03-29, 1400, S1).

## Time codes

The service converts `time_code` to start/end times (America/Chicago, 8.5h duration). Supported formats:

- **1–2 digit hour:** `6`, `06`, `14`
- **HH:MM:** `6:00`, `14:00`
- **4-digit HHMM:** `0600`, `1400`, `1200`
- **3-digit HMM:** `600` → hour 6

Hour must be 0–23.

## Desk codes

- Examples: S1, S4, TRN, etc.
- **TRN** (and ITR) are treated as training; shifts are shown on the board but not tradable.
- Leave codes (e.g. OFF, VAC, SICK) are filtered out and not imported as shifts.
- Other codes are resolved to workgroup/desk type via workgroup position ranges; unmapped codes are recorded in `schedule_unmapped_codes` for admin mapping.

## Files

- Exports may be named like `expanded_schedule_STD (10).csv`; the one with headers is the one the parser expects (the line containing "Name (ID) Qualification").
- Multiple month blocks can appear in one file; the parser loops over each header trio and consumes employee rows until the next header or end of file.
