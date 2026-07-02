# SE Manager Dashboard

A local web dashboard for LATAM SE Managers to track pipeline, team coverage, partner relationships, and team goals — all in one place.

## Features

- **Business** — Pipeline deals with filters, SE alignment check, SFDC links
- **YTD** — Closed-won analytics with quota attainment charts
- **Events & Coverage** — Marketing events + team travel status
- **Initiatives** — Team projects and demo recording progress
- **People** — SE goals, 1:1 notes, top of mind, travel
- **Partners** — 170+ LATAM partners with contacts, tiers, SFDC links

## Setup

### 1. Install dependencies
```bash
cd se-manager-dashboard
npm install
```

### 2. Add your data
Copy the sample files and populate with your own data:
```bash
cp data/sample-deals.json data/deals.json
cp data/sample-partners.json data/partners.json
```

You also need to create these files (see `data/` folder for sample structure):
- `data/events.json` — team events and travel
- `data/projects.json` — initiatives
- `data/people.json` — SE team members and goals
- `data/ytd.json` — closed-won deals for YTD charts

Create the notes directory for 1:1 notes:
```bash
mkdir -p data/notes
touch data/notes/se1.md data/notes/se2.md
```

### 3. Run
```bash
npm start
```

Open **http://localhost:3001**

## Data Sources

The dashboard is designed to sync from:
- **Salesforce** (via Google Sheets connector) — deals, partners, closed-won
- **Navan** — SE travel bookings
- **Google Calendar** — event confirmations
- **Zoom** — 1:1 meeting summaries
- **Slack** — team activity context

## Data Structure

All data lives in `data/*.json`. See the `sample-*.json` files for the expected schema.

| File | Contents |
|---|---|
| `deals.json` | Pipeline opportunities |
| `partners.json` | Partner accounts + contacts |
| `events.json` | Marketing/industry events + travel |
| `projects.json` | Team initiatives |
| `people.json` | SE team members, goals, top-of-mind |
| `ytd.json` | Closed-won deals + YTD metrics |
| `notes/<name>.md` | 1:1 notes per person |

## Stack

- **Node.js + Express** — API server (port 3001)
- **Alpine.js v3** — Reactive UI
- **Tailwind CSS** — Styling
- **Chart.js** — YTD charts

## Notes

- Data files (`data/`) are excluded from version control — never commit real customer or employee data
- The app is local-only by design; deploy behind auth if sharing over a network
