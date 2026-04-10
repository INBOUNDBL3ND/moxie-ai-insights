# MOXIE AI Insights — Project Handoff

## Overview

MOXIE AI Insights is a static HTML marketing performance dashboard system built for **Inbound Blend**. Each client gets a password-protected monthly report showing their marketing metrics, activity logs, and service summary. The site is deployed on **Netlify**.

**Live URL:** Deployed via `npx netlify deploy --dir=. --prod`
**Password:** `8675` (all clients share one access code)

---

## Architecture

```
moxie-ai-insights/
├── index.html              # Landing page — client number entry
├── netlify.toml             # Netlify config (publish dir, headers)
├── css/moxie.css            # Full design system
├── js/gate.js               # Password gate (sessionStorage + base64)
├── data/clients.json        # Client number → name mapping (36 clients)
├── assets/
│   ├── moxie-mascot.png     # MOXIE robot mascot (1024px)
│   ├── moxie-mascot-small.png
│   ├── moxie-mascot-xs.png  # (512px, used in headers/gate)
│   ├── inbound-blend-logo.png
│   └── (other logo assets)
└── clients/
    └── {7-digit-number}/
        ├── index.html             # Client dashboard (lists reports)
        ├── february-2026.html     # Monthly report
        └── march-2026.html        # Monthly report
```

### How It Works

1. Client visits the site → enters 7-digit client number on landing page
2. Number is validated against `data/clients.json`
3. Redirects to `/clients/{number}/` dashboard
4. Password gate (`js/gate.js`) prompts for access code on every page
5. Once authenticated, `sessionStorage` keeps them in for the browser session

---

## Data Sources

### Google Sheet
- **Primary data source** for all marketing metrics
- Two tabs:
  - **February 2026** — `gid=57523013` (full data)
  - **March 2026** — `gid=1572531636` (partial data, still being entered)
- **Sections in the sheet:** Google Ads, Facebook/Meta Ads, LinkedIn Ads, Microsoft/Bing Ads, Digital Billboards, Social Media Posts (Likes/Views/Impressions), Email Newsletter (Sent To/Opens/Clicks), Website Traffic (Sessions), AdRoll, TikTok
- **Important:** Tab GIDs are counterintuitive — verify which tab you're reading before pulling data

### Slack
- Client-specific channels contain activity logs and service block details
- Used to populate "What We Did This Month" and "Your Active Marketing Services" sections
- Activities must be strictly filtered by month — no repeats unless recurring services

---

## Report Structure

Each monthly report (`{month}-{year}.html`) contains:

| Section | Description |
|---------|-------------|
| **Report Header** | Month/year, client name, MOXIE mascot (200px) |
| **Breadcrumb** | Home → Client → Month |
| **TL;DR** | 1-paragraph executive summary of the month |
| **At a Glance** | 4 metric cards (top-line numbers) |
| **Performance Overview** | Horizontal CSS bar chart (relative scale) |
| **Platform Breakdown** | Cards per platform (budget, spend, impressions, clicks, etc.) with budget utilization bars |
| **What We Did This Month** | Activity list from Slack (month-specific only) |
| **Your Active Marketing Services** | Blue pills showing service blocks |
| **Opportunities to Explore** | Strategic recommendation card |
| **Footer** | Inbound Blend logo linked to inboundblend.com |

---

## Design System

- **Colors:** Blue `#1D80DE`, Orange `#DF6229`, Green `#27AE60`
- **Font:** Barlow (Google Fonts)
- **Layout:** Max-width 1100px, responsive down to 375px
- **Charts:** Pure CSS horizontal bars (no JavaScript charting library)
- **Mascot:** MOXIE robot — friendly AI assistant aesthetic

---

## 36 Clients

| Number | Name |
|--------|------|
| 1708001 | Inbound Blend |
| 1801001 | NWO |
| 1808002 | DP Pumps |
| 1808004 | Pumps and Parts |
| 1907001 | Patriot |
| 1908001 | Bart Inman Air |
| 1910002 | BEAM |
| 2009003 | MedSearch |
| 2010001 | Epoxy Stone |
| 2103001 | Mentors 4 College |
| 2106002 | Brown and Brown |
| 2203005 | City of Ellisville |
| 2205001 | Leathers Interiors |
| 2301001 | Ranson & Associates |
| 2306001 | Elite Testosterone |
| 2308001 | Jones Family Law Group |
| 2401006 | Partners In Medicine |
| 2404002 | U Store It OFallon |
| 2404003 | ALO Construction |
| 2405002 | Whack A Mole |
| 2407003 | Just Dancing |
| 2407004 | Just Pilates |
| 2408002 | Organized to Thrive |
| 2412001 | Sinclair and Rush |
| 2412002 | VisiPak |
| 2412003 | IndePak |
| 2504002 | Fuzzywumpets |
| 2508005 | Lift Station Depot |
| 2509002 | BP Texas |
| 2509003 | Midalloy SM |
| 2509004 | Luna Builds STL |
| 2510002 | Whitewater Freight |
| 2512001 | MotoSetup Pro |
| 2601001 | West St. Louis County Chamber of Commerce |
| 2601002 | Jeff Baker & Sons Landscaping |
| 2602002 | GRN Dublin |

---

## Adding a New Month

To generate reports for a new month (e.g., April 2026):

1. **Add a new tab** in the Google Sheet with that month's data
2. **Pull data** from the Google Sheet for each client (all sections: ads, social, email, website, etc.)
3. **Pull Slack activity** from each client's channel for that month only
4. **Create `{month}-{year}.html`** for each client using the report template structure above
5. **Update each client's `index.html`** to add the new report card to the reports grid
6. **Deploy:** `npx netlify deploy --dir=. --prod`

### Adding a New Client

1. Add entry to `data/clients.json`
2. Create `clients/{number}/` directory
3. Create `index.html` dashboard and monthly report files
4. Deploy

---

## Deployment

```bash
# From project root
npx netlify deploy --dir=. --prod
```

The Netlify site is linked to the local directory. No CI/CD pipeline is active — deployment is manual via CLI.

---

## Password Gate

- Password: `8675`
- Stored as base64 in `js/gate.js`: `ODY3NQ==`
- Uses `sessionStorage` — clears when browser tab closes
- Gate overlay blocks all page content until correct code is entered
- To change the password: update the `HASH` constant in `gate.js` to the new base64 value (`btoa('newpassword')`)

---

## Known Items

- **Apps Script:** Code was written in the Google Apps Script editor to create a JSON API endpoint for the spreadsheet data, but it was never saved/deployed. This would automate data extraction. Currently data is read manually from the sheet.
- **March 2026 reports:** Have less complete data than February — mostly budget/spend info. Full metrics (impressions, clicks, social, email, website) still need to be entered in the sheet.
- **GitHub Actions:** A deploy workflow was drafted but couldn't be pushed due to OAuth scope limitations. Deployment remains manual via Netlify CLI.
