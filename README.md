# Huishouden Baby

A wall-tablet app for a household expecting a baby. Before the birth it shows the due-date countdown,
upcoming appointments and checklists (hospital bag, car seat, nursery, paperwork). After the birth the
main screen becomes a one-tap log of feeds, sleep, diapers and pumping, readable from across the room:
when the baby last ate, how long they have been asleep or awake, and today's totals. Every entry shows
who logged it, and the whole household sees the same log.

Live at https://huishouden-baby.web.app, also linked from the [Huishouden portal](https://huishouden-piekstra.web.app).
Installable on the tablet, phones and laptops, and works offline (entries sync when the connection is back).

## Screenshots

| Before the birth | After: the log |
|---|---|
| ![Countdown, next appointment and checklists](docs/screenshots/before.png) | ![Last fed, asleep for, last diaper, log buttons and today's timeline](docs/screenshots/log.png) |

| Checklists | Phone |
|---|---|
| ![Checklists grouped by list](docs/screenshots/checklists.png) | ![The log on a phone](docs/screenshots/phone-log.png) |

_Screenshots of the live site signed out, which shows an invented sample family dated in 2031 (`?demo=after` for the log). Refreshed by CI after each deploy._

## Data

Signed-in members of a Huishouden household read and write under `households/{householdId}`:
`babyProfile/main` (name, due date, birth date), `babyEvents` (feed, sleep, diaper, pump),
`babyChecklists` and `babyAppointments`. The Firestore rules live in the repo that owns the project's
rules file. Signing in uses Google with no extra scopes; the household comes from the shared
`households` document, so one invite from the portal opens every Huishouden app.

## Develop

```sh
bun install          # also enables the pre-commit leak scan
bun run env:pull     # writes .env.local from the repo's VITE_* variables
bun run dev          # http://localhost:3002
bun run lint && bun run test && bunx pwa-design-check && bun run build
bun run e2e          # Playwright smoke tests against the live site (BASE_URL to override)
bun run screenshots  # README screenshots (SCREENSHOT_DIR to override)
bun run icons        # regenerate the logo and PNG icons
```

Built on [huishouden-pwa-kit](https://github.com/huishouden/pwa-kit) and follows its
[design language](https://github.com/huishouden/pwa-kit/blob/main/DESIGN.md) and
[standard](https://github.com/huishouden/pwa-kit/blob/main/STANDARD.md). Pushes to `main` deploy to
Firebase Hosting (project `huishouden-piekstra`, site `huishouden-baby`), then run the smoke tests and refresh the screenshots.
