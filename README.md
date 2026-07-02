# SE Manager Dashboard

A local web dashboard for SE Managers to track team pipeline, events & travel coverage, YTD performance, people goals, and partner activity — all in one place.

Data is populated by Claude Code sessions that read your connected sources (Google Sheets, Gmail, Calendar, Slack, Zoom) and write local JSON files. The dashboard serves them via a lightweight Node/Express server.

---

## What's in Each Tab

| Tab | What it shows | Primary data source |
|-----|--------------|---------------------|
| **Business** | Open pipeline by quarter, SE, platform | Google Sheets (SFDC/Clari sync) |
| **YTD** | Closed won vs quota, SE attainment, charts | Manual export from Salesforce/Clari |
| **Events & Coverage** | Upcoming events, SE travel, Navan bookings | Marketing calendar + Gmail + Calendar + Slack + Zoom |
| **People** | SE goals, 1:1 notes, attainment tracking | Manual + individual Google Drive goal docs |
| **Partners** | Partner list, tiers, deal activity | Google Sheets (SFDC partner sync) |
| **Initiatives** | Team projects and enablement tracking | Manual |

---

## Prerequisites

- **Node.js ≥ 18** — [nodejs.org](https://nodejs.org)
- **Claude Code** — [claude.ai/code](https://claude.ai/code) — used to refresh data
- **Google MCP** connected in Claude Code — covers Sheets, Gmail, Calendar, Drive
- **Slack MCP** connected in Claude Code — for event and travel mentions
- **Zoom MCP** connected in Claude Code — for meeting summaries (optional)
- A **Google Sheet** synced to your Salesforce pipeline (via Clari, Coefficient, or a custom SOQL connector)

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/victorjfuenmayor/se-manager-dashboard.git
cd se-manager-dashboard
npm install
```

### 2. Configure your team

```bash
cp data/sample-config.json data/config.json
```

Open `data/config.json` and fill in every section (see [Config Reference](#config-reference) below).

### 3. Create the data and notes folders

```bash
mkdir -p data/notes
```

### 4. Connect your MCP sources in Claude Code

In Claude Code settings, make sure these MCP servers are connected and authenticated:

- **Google** — covers Sheets, Gmail, Calendar, Drive in one connection
- **Slack** — for event and travel mentions in your team channels
- **Zoom** — for meeting summaries (optional, improves Events & Coverage)

### 5. Run your first data refresh

Open Claude Code in this project folder and say:

```
refresh the dashboard
```

Claude will read all your connected sources and populate the `data/` JSON files. This takes 2–5 minutes on first run.

### 6. Start the dashboard

```bash
npm start
```

Open [http://localhost:3001](http://localhost:3001)

---

## Config Reference

Every configurable value lives in `data/config.json`. Start from `data/sample-config.json` which has placeholders and explanations for each field.

| Field | What it is | Where to find it |
|-------|-----------|-----------------|
| `manager.name` | Your name (shown in the dashboard header) | — |
| `manager.quota` | Your team's annual ARR quota | Your comp plan / manager |
| `manager.region` | Region label (display only) | Your choice |
| `manager_above.name` | Your manager's name | — |
| `team[].id` | Unique identifier; must match the filename in `data/notes/` | Choose any lowercase slug |
| `team[].match` | Substring of the SE's first name as it appears in Salesforce | First name is usually enough |
| `team[].color` | Hex color for this SE's data in charts and KPI cards | Your choice |
| `team[].platform` | Primary specialty: `OWI`, `Auth0`, or `Both` | Team knowledge |
| `team[].individualTarget` | SE's individual ARR target for the year | Their comp plan |
| `alignment[].ae` | Lowercase substring of the AE's last name in Salesforce | Pipeline report → Opportunity Owner |
| `alignment[].okta_se` / `.auth0_se` | SE full name for OWI vs Auth0/CIC deals | Territory mapping |
| `salesforce.domain` | Your Lightning URL without `https://` | Your Salesforce URL bar |
| `salesforce.sales_area_filter` | `Account_Owner_Sales_Area__c` value for your region | Salesforce field value |
| `fiscal_year.start_month` | Month number when your FY begins (1=Jan, 2=Feb, …) | Finance / comp plan |
| `fiscal_year.current_quarter_end` | Last day of the current quarter (`YYYY-MM-DD`) | Your fiscal calendar |
| `sheets.pipeline.id` | 44-char ID from your pipeline Sheet URL | Between `/d/` and `/edit` in the URL |
| `sheets.pipeline.tab` | Exact tab name for open pipeline | Open the sheet |
| `sheets.vf_context_notes.id` | Same sheet ID — where manager notes are written back | Same sheet |
| `sheets.vf_context_notes.tab` | Tab name for manager note write-back | Create this tab if it doesn't exist |
| `sheets.partners.id` | Sheet ID of your partner list from Salesforce | Sheet URL |
| `sheets.events_calendar.id` | Sheet ID of your marketing events calendar | Sheet URL |
| `docs.team_weekly_notes.id` | Google Doc ID of your team's weekly meeting notes | Between `/document/d/` and `/edit` |
| `goals_docs.first.last` | Google Drive doc ID for each SE's goals doc | Doc URL |
| `slack.channels` | Channel names (without `#`) to search for travel/event mentions | Slack sidebar |

---

## Data Sources by Tab

### Business (deals.json)

Reads your pipeline Google Sheet — the same one that syncs from Salesforce. Pulls all open opportunities for your sales area with close dates in the current fiscal year. Normalizes platform values (`Okta Workforce Identity` → `OWI`, `Auth0` → `Auth0`, `Okta Customer Identity` → `OCI`). Calculates fiscal quarter from close date using `fiscal_year.start_month`.

**SOQL query for your pipeline sheet:**

```sql
SELECT
    Name, CloseDate, Forecasted_Technical_Win_Date__c, Amount,
    AE_Qual_Use_Case__c, Opportunity_Owner__c, Sales_Engineer__c,
    CSM_Notes__c, SE_Notes__c, Pre_Sales_Notes__c,
    Presales_Stage__c, StageName, Technical_Probability__c,
    Need_next_steps__c, Manager_1_1_Notes__c,
    Technical_Differentiation__c, Why_Do_Anything__c,
    Why_Do_It_Now__c, Why_Okta__c, POC_Status__c, Opportunity.Id
FROM Opportunity
WHERE
    Account_Owner_Sales_Area__c LIKE '%YOUR_REGION%'
    AND StageName NOT IN ('1 - Validate Lead','10 - Closed/Won','0 - Qualified Out','11- Closed/Lost')
    AND CloseDate >= YYYY-MM-DD
    AND CloseDate <= YYYY-MM-DD
LIMIT 10000
```

Replace `YOUR_REGION` with `salesforce.sales_area_filter` from your config.

**To refresh:** `refresh the dashboard` in Claude Code.

---

### Events & Coverage (events.json)

Combines six sources:

1. **Marketing events sheet** (`sheets.events_calendar`) — official FY event calendar
2. **Team weekly notes doc** (`docs.team_weekly_notes`) — who is traveling where
3. **Gmail / Navan** — confirmed flight and hotel booking emails for your SEs
4. **Google Calendar** — your own calendar for events you're attending
5. **Slack** (`slack.channels`) — travel and event mentions from your team channels
6. **Zoom** — recent meeting summaries referencing upcoming events

Each event entry in `events.json` has this shape:

```json
{
  "icon": "🔒",
  "name": "Event Name",
  "date": "Jul 9, 2026",
  "location": "City, Country",
  "type": "Partner Event",
  "team": ["SE Full Name"],
  "notes": "Context about this event",
  "travel": [
    {
      "se": "SE Full Name",
      "flight": "✅ MEX→GDL Jul 8 | AM0222 (YGLCPT)",
      "hotel": "✅ Hotel Name, Jul 8–10 (NAVAN XXXXXX)",
      "status": "confirmed",
      "return": "GDL→MEX Jul 10 | AM0209 (YGLCPT)"
    }
  ]
}
```

**Travel status values:** `confirmed` | `pending` | `missing`

**To refresh:** `refresh the dashboard` or `refresh the events and coverage section` in Claude Code.

---

### YTD (ytd.json)

Tracks closed-won deals for the fiscal year. This file requires a manual export from Salesforce or Clari — closed-won pipeline lives in a different report from open pipeline.

**Required structure:**

```json
{
  "quota": 8000000,
  "totalClosed": 0,
  "quotaAchievement": 0,
  "dealCount": 0,
  "lastUpdated": "YYYY-MM-DD",
  "deals": [
    { "name": "...", "ae": "...", "type": "New Business", "platform": "OWI",
      "se": "Full Name", "amount": 0, "date": "M/D/YYYY", "quarter": "Q1" }
  ],
  "bySE": [{ "se": "Full Name", "amount": 0 }],
  "byType": [{ "type": "New Business", "amount": 0, "count": 0 }],
  "byPlatform": [{ "platform": "OWI", "amount": 0, "count": 0 }],
  "byQuarter": [{ "quarter": "Q1", "amount": 0, "count": 0 }],
  "newBizTotal": 0,
  "newBizBySE": [{ "se": "Full Name", "amount": 0 }]
}
```

**To refresh:** Export closed-won deals from Salesforce/Clari, paste to Claude Code: `update ytd from this closed won report: [paste data]`

---

### People (people.json + data/notes/*.md)

`people.json` holds structured SE profiles with goals and progress tracking. 1:1 notes are typed directly in the dashboard and saved per-person to `data/notes/<id>.md` (where `id` matches `team[].id` in your config).

Goal doc IDs are configured in `goals_docs` in `config.json` — Claude Code reads those Drive docs when updating goal tracking.

**To update goals from 1:1 notes:** Say `update [SE name]'s goals from their notes` in Claude Code.

---

### Partners (partners.json)

Reads your partner list from Salesforce. Each partner entry includes name, country, tier, contacts, and deal activity. Refresh monthly — the data changes slowly.

**To refresh:** `refresh the partners tab` in Claude Code.

---

## Refreshing Data

All refresh commands are spoken to Claude Code with this project open:

| What to refresh | Claude Code command |
|----------------|---------------------|
| Everything | `refresh the dashboard` |
| Pipeline only | `refresh the pipeline data` |
| Events & travel only | `refresh the events and coverage section` |
| Partners | `refresh the partners tab` |
| One SE's goals | `update [name]'s goals from their notes` |
| All SE goals | `update all SE goals from their notes` |
| Write notes to Sheet | Click **Export** in dashboard → copy text → paste to Claude Code |

---

## Running the Dashboard

```bash
# Start
npm start

# Start with auto-restart on server changes (development)
npm run dev
```

Open [http://localhost:3001](http://localhost:3001)

The server reads JSON files fresh on each API call — no restart needed after a data refresh.

---

## Project Structure

```
se-manager-dashboard/
├── server.js               # Express server — API + static file serving
├── index.html              # Dashboard UI (Alpine.js + Tailwind CDN + Chart.js)
├── dashboard.js            # All frontend logic
├── package.json
├── README.md
├── .gitignore              # data/ and notes/ are excluded from git
└── data/                   # NOT in git — stays local to each user
    ├── config.json             # Your team config (copy from sample-config.json)
    ├── sample-config.json      # Template with all fields — safe to commit
    ├── deals.json              # Open pipeline (populated by Claude Code)
    ├── events.json             # Events & travel coverage
    ├── ytd.json                # Closed-won YTD data
    ├── people.json             # SE profiles and goals
    ├── partners.json           # Partner list
    ├── projects.json           # Team initiatives
    └── notes/
        └── <se-id>.md          # Per-SE 1:1 notes (one file per team member)
```

---

## Stack

- **Node.js + Express** — API server (port 3001)
- **Alpine.js v3** — Reactive UI, no build step
- **Tailwind CSS** (CDN) — Styling
- **Chart.js** (CDN) — YTD charts

---

## Troubleshooting

**Dashboard shows no data / loading spinner stuck**
→ Make sure the server is running (`npm start`) and `data/deals.json` exists. Run a data refresh first.

**Salesforce links don't work**
→ Check `salesforce.domain` in `config.json` — should be your Lightning URL without `https://`.

**SE pipeline totals don't match the table**
→ Make sure `team[].match` values are unique substrings of your SEs' names as they appear in the `Sales_Engineer__c` field in Salesforce.

**Quarter labels show wrong months**
→ Update `fiscal_year.start_month` to match when your company's FY starts.

**Export button references wrong Sheet**
→ Update `sheets.vf_context_notes.id` in `config.json`.

**Events & Coverage tab is empty**
→ `events.json` must be populated via a Claude Code refresh — it doesn't auto-generate on first run.

---

## Notes

- All data files (`data/`) are gitignored — your pipeline data never leaves your machine
- If deploying over a network, add authentication — the server has no auth by default
- `sample-config.json` is safe to commit; `config.json` is not (it contains your real IDs)
