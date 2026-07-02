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

The dashboard syncs from:
- **Salesforce** (via Google Sheets connector) — deals, partners, closed-won
- **Navan** — SE travel bookings
- **Google Calendar** — event confirmations
- **Zoom** — 1:1 meeting summaries
- **Slack** — team activity context

## Salesforce → Google Sheets Setup

Create a Google Sheet connected to Salesforce using a connector (Coefficient, Data Connector for Salesforce, or Zapier). Use this SOQL query for the **pipeline tab**:

```sql
SELECT
    Name,
    CloseDate,
    Forecasted_Technical_Win_Date__c,
    Amount,
    AE_Qual_Use_Case__c,
    Opportunity_Owner__c,
    Sales_Engineer__c,
    CSM_Notes__c,
    SE_Notes__c,
    Pre_Sales_Notes__c,
    Presales_Stage__c,
    StageName,
    Technical_Probability__c,
    Need_next_steps__c,
    Manager_1_1_Notes__c,
    Technical_Differentiation__c,
    Why_Do_Anything__c,
    Why_Do_It_Now__c,
    Why_Okta__c,
    POC_Status__c,
    Opportunity.Id
FROM
    Opportunity
WHERE
    Account_Owner_Sales_Area__c LIKE '%LATAM%'
    AND StageName NOT IN (
        '1 - Validate Lead',
        '10 - Closed/Won',
        '0 - Qualified Out',
        '11- Closed/Lost'
    )
    AND CloseDate >= 2026-04-01
    AND CloseDate <= 2027-01-31
LIMIT 10000
```

**Adjust the filters** for your region (`Account_Owner_Sales_Area__c`) and date range.

### Field mapping

| SOQL Field | Dashboard field |
|---|---|
| `Name` | Opportunity name |
| `CloseDate` | Close date |
| `Forecasted_Technical_Win_Date__c` | Tech Win date |
| `Amount` | Deal amount |
| `AE_Qual_Use_Case__c` | Platform (OWI / Auth0 / OCI) |
| `Opportunity_Owner__c` | AE name |
| `Sales_Engineer__c` | Lead SE |
| `CSM_Notes__c` | VF / SE Manager notes |
| `SE_Notes__c` | SE notes |
| `Need_next_steps__c` | AE notes |
| `Manager_1_1_Notes__c` | ASD notes |
| `Presales_Stage__c` | PreSales stage |
| `StageName` | SFDC stage |
| `Technical_Probability__c` | Confidence |
| `Opportunity.Id` | SFDC link (18-char ID) |

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

## Syncing data with Claude

The recommended way to keep the dashboard current is to use **Claude Code** with MCP tools. Once you have your Google Sheet set up:

1. Install [Claude Code](https://claude.ai/code)
2. Configure MCP servers for Google Workspace, Slack, and Zoom in `~/.claude/settings.json`
3. Open the project folder in Claude Code
4. Say: **"refresh the dashboard"** — Claude will read your Sheet, email, Calendar, Zoom, and Slack and write all the JSON files

You can also refresh individual sections:
- *"Refresh just the business deals from Sheet ID [your-sheet-id]"*
- *"Update the partner data"*
- *"Sync events and travel from my calendar and Navan emails"*

## Notes

- Data files (`data/`) are excluded from version control — never commit real customer or employee data
- The app is local-only by design; deploy behind auth if sharing over a network
