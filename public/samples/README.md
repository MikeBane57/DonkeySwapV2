# Buddy bid Google Calendar test imports

Fixed **Feb 2027 smoke** calendars for safe import testing (~13 events each, not a full bid year).

| File | Use |
|------|-----|
| `buddy-bid-gcal-test-feb2027-smoke-am.ics` | AM buddy (0600 / doubles / training / relief) |
| `buddy-bid-gcal-test-feb2027-smoke-pm.ics` | PM buddy (1400 / doubles / training / relief) |

Regenerate after export logic changes:

```bash
npm run gcal:test-samples
```

Live URL (when deployed): `/samples/buddy-bid-gcal-test-feb2027-smoke-am.ics`