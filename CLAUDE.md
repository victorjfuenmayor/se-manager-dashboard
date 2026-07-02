# SE Manager Dashboard — Claude Code Instructions

## What this project is

A local web dashboard for SE Managers to track team pipeline, events & travel coverage, YTD performance, people goals, and partner activity. Data is populated by Claude Code reading Google Sheets, Gmail, Calendar, Slack, Zoom, and Gong summaries, then writing local JSON files that the dashboard serves.

## First-time setup detection

**Before doing anything else**, check whether `data/config.json` exists:

```bash
ls data/config.json 2>/dev/null || echo "MISSING"
```

- If it **exists** → skip to [Refresh Data](#refresh-data)
- If it **does not exist** → run the [First-Time Setup](#first-time-setup) flow below

---

## First-Time Setup

Greet the user and explain what you're doing:

> "Welcome! I'll walk you through setting up the SE Manager Dashboard for your team. I'll ask you a few questions and build your config file. It should take about 5 minutes."

Then collect answers to each section below **one section at a time** — don't ask everything at once. After collecting all answers, write `data/config.json` using the structure from `data/sample-config.json`, then proceed to [Connect MCP Sources](#connect-mcp-sources).

### Section 1 — About you

Ask:
1. Your full name
2. Your work email
3. Your region or territory (e.g. LATAM, EMEA, APAC, US West)
4. Your team's annual quota in USD (just the number, e.g. 8000000)
5. Your manager's name and role

### Section 2 — Your SE team

Ask:
> "How many SEs are on your team?"

For **each SE**, ask:
1. Full name
2. First name (used to match deals in Salesforce — usually just their first name)
3. Primary platform specialty: OWI (Workforce Identity), Auth0/CIC (Customer Identity), or Both
4. Their individual ARR target for the year in USD
5. Their location (City, Country)
6. Their role/title (e.g. Senior SE — Brazil)

Suggest colors automatically (use this palette in order): `#3B82F6`, `#8B5CF6`, `#14B8A6`, `#EC4899`, `#F97316`, `#10B981`

### Section 3 — AE to SE alignment

Explain:
> "Now I need to know which AE maps to which SE, so I can flag misaligned deal assignments. For each AE, I need part of their last name as it appears in Salesforce, and which SE handles their OWI deals vs Auth0/CIC deals."

Ask for each AE-to-SE mapping they want to configure. Minimum 2, no maximum.

### Section 4 — Salesforce

Ask:
1. Your company's Salesforce Lightning URL (e.g. `mycompany.lightning.force.com`) — find it in your browser's address bar when in Salesforce
2. The value of `Account_Owner_Sales_Area__c` for your region in Salesforce (e.g. `LATAM`, `EMEA`) — this is used to filter your pipeline

### Section 5 — Fiscal year

Ask:
1. What month does your fiscal year start? (e.g. February for Okta, January for most companies)
2. What is the last day of your current fiscal quarter? (format: YYYY-MM-DD)

### Section 6 — Google Sheets

Explain:
> "I need the IDs of your Google Sheets. You can find the ID in the URL of any sheet: it's the long string between `/d/` and `/edit`."

Ask for:
1. **Pipeline sheet** — the Google Sheet that syncs your open opportunities from Salesforce (via Clari, Coefficient, or a similar connector)
   - Sheet ID
   - Tab name for open pipeline
2. **Manager notes tab** — the tab in that same sheet where you want to write back your deal notes (create it now if it doesn't exist; suggest "Manager Context Notes" as the name)
3. **Partners sheet** — your partner list from Salesforce (optional — press Enter to skip)
   - If provided: Sheet ID and tab name
4. **Marketing events calendar** — a Google Sheet your marketing team maintains with the FY event calendar (optional — press Enter to skip)
   - If provided: Sheet ID and tab name

### Section 7 — Google Docs

Ask for:
1. **Team weekly notes doc** — the Google Doc where your team's weekly meeting notes are kept (optional)
   - Doc ID (the string between `/document/d/` and `/edit` in the URL)
2. **SE goals docs** — for each SE on the team, their individual goals Google Doc ID (optional — can be added later)

### Section 8 — Slack

Ask:
1. What Slack channels (without `#`) should I monitor for travel and event mentions? (e.g. `latam-aes-ses, latam-sales-team`)
2. Do you have a Gong summaries channel in Slack? If yes, what's the channel name? (This is where Gong posts call summaries — check if it's private or public)

### Section 9 — Write config.json

After collecting all answers, write `data/config.json` following the exact structure in `data/sample-config.json`. Remove all `_comment` fields from the output file. Show a summary of what was written and ask the user to confirm before proceeding.

---

## Connect MCP Sources

After config is written (or if running setup again), verify MCP connections:

1. **Google MCP** — test by calling a simple Sheets read on the configured pipeline sheet ID. If it fails, tell the user:
   > "Your Google MCP doesn't seem to be connected. In Claude Code, go to Settings → MCP Servers and make sure the Google server is connected and authenticated with your work Google account."

2. **Slack MCP** — test by searching for any message in the configured channels. If it fails:
   > "Your Slack MCP isn't connected. In Claude Code settings, connect the Slack MCP server and authenticate with your workspace."

3. **Zoom MCP** (optional) — if connected, use it for meeting summaries. If not, skip silently.

4. **Gong summaries channel** — if configured, try to read recent messages from it. Note whether it's a private channel (requires Slack MCP to have access).

---

## Refresh Data

This is the main workflow. Run when the user says **"refresh the dashboard"**, **"update the dashboard"**, or similar.

Always read these sources **in parallel** where possible:

### 1. Deals (Business tab)
- Read `config.sheets.pipeline.id`, tab `config.sheets.pipeline.tab`
- Read columns A:G (name, date, tech win date, amount, platform, AE, SE) — read in batches of 50 rows to avoid API truncation
- Also read column U (Salesforce ID) in batches
- Normalize platforms: `Okta Workforce Identity` → `OWI`, `Auth0` → `Auth0`, `Okta Customer Identity` / `CIC` → `OCI`, `Multiple Use Cases` → `Both`
- Calculate fiscal quarter from close date using `config.fiscal_year.start_month`: Q1=months 1-3 of FY, Q2=months 4-6, Q3=months 7-9, Q4=months 10-12
- Filter: exclude deals with amount ≤ 0 (negative renewals, $0 entries)
- Enrich with notes from existing `data/deals.json` (match by name) to preserve VF notes, SE notes, presales stage, confidence, SFDC ID
- Write to `data/deals.json`

### 2. Events & Coverage
Read all six sources in parallel:

**a. Marketing events sheet** (`config.sheets.events_calendar`) — official FY calendar with dates, types, locations

**b. Team weekly notes doc** (`config.docs.team_weekly_notes`) — who is traveling, event assignments, activity plans

**c. Gmail / Navan** — search for `from:navan subject:confirmed OR subject:booking` to find SE flight and hotel confirmations. For each SE, extract: traveler name, route, dates, confirmation code, hotel

**d. Google Calendar** — read upcoming events (next 6 months) filtering out: "Blocked", "Florida", "Salesforce Hygiene", recurring internal meetings. Focus on: travel bookings (Navan-created), external events, customer visits, conferences

**e. Slack channels** (`config.slack.channels`) — search for mentions of travel, events, conferences, partner activities. Include the Gong summaries channel if configured.

**f. Zoom** — search recent meetings for summaries mentioning upcoming events or customer visits

Build/update `data/events.json`. Each event needs: `icon`, `name`, `date`, `location`, `type`, `team` (array of SE full names), `notes`, `travel` (array with se, flight, hotel, status, return).

Travel status values: `confirmed` (Navan booking found), `pending` (mentioned but no booking), `missing` (expected but no evidence).

**Event types:** `Partner Event`, `Industry Event`, `Okta Event`, `Okta Internal`, `Okta Training`, `Customer Visit`

### 3. Gong summaries (customer context)
If `config.slack.channels` includes a Gong channel:
- Read recent messages (last 30 days)
- For each call summary, extract: account name, key topics, next steps, deal signals
- Cross-reference with deals in `data/deals.json` by account name
- If a deal matches: note the call date and key context in `seNotes` or a note field
- If no deal matches but the call is about a customer/prospect: flag it as a new prospect signal

### 4. Partners (monthly only)
Only refresh if `data/partners.json` is older than 30 days or the user explicitly asks.
- Read `config.sheets.partners.id`, tab `config.sheets.partners.tab`

Write all updated files. Report a summary: how many deals, events, Gong calls processed.

---

## Other Commands

### "run SE manager notes" or "generate weekly notes"
Generate structured SE Manager Notes for all open deals >$100K. Read the pipeline sheet fresh, apply the SE Manager Notes template (from memory), output a table with opportunity + notes. Also generate an inspection list flagging misaligned stages, missing champions, blank fields.

### "update [SE name]'s goals"
Read `config.goals_docs.[first.last]` from Google Drive, read `data/notes/<id>.md` for recent 1:1 context, update the goals tracking in `data/people.json`.

### "refresh the partners tab"
Force-refresh `data/partners.json` from `config.sheets.partners`.

### "run weekly notes and send to my email"
Full SE Manager Notes run + send summary email to `config.manager.email`.

---

## Important rules

- **Never commit `data/config.json`** — it contains real Sheet IDs and personal information. It is gitignored by design.
- **Never commit `data/*.json`** (except `sample-config.json`) — pipeline data is sensitive.
- **Never overwrite `CSM_Notes__c`** — that Salesforce field is read-only from this tool. Write-back only goes to the Manager Context Notes tab.
- **Batch Sheet reads** — the Google Sheets API truncates responses at ~50 rows. Always read large sheets in batches (A2:G51, A52:G101, etc.) and combine results.
- **Deduplicate deals** — when rebuilding deals.json, deduplicate by (name + closeDate) to avoid counting the same deal twice from overlapping batch reads.
- **Preserve existing notes** — when refreshing deals, always carry forward existing `vfNotes`, `seNotes`, `asdNotes`, `aeNotes`, `sfdcId`, `presalesStage` from the current deals.json. Only overwrite with new Sheet data for: `amount`, `closeDate`, `techWinDate`, `platform`, `ae`, `se`, `sfdcStage`, `confidence`.
