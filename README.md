# WarmDM — Cold DM & Outreach CRM

Turn cold LinkedIn DMs into warm leads, track responses, and run personalized outreach campaigns.

## Architecture

```
linkedin-crm/
  extension/     Chrome Manifest V3 extension (runs inside LinkedIn)
  backend/       Node.js + Express + MongoDB API
  dashboard/     Next.js dashboard (localhost:3000)
```

## How it works

1. Extension reads LinkedIn's DOM (conversations, messages, profiles)
2. Backend stores contacts, groups, templates, campaigns, reply status
3. Dashboard is your CRM — manage groups, build campaigns, see who replied
4. Extension sends messages through LinkedIn's own UI (no API — undetectable)

## Setup

### 1. Backend
```bash
cd backend
npm install
npm run dev          # starts on :4000
```
Requires MongoDB running locally (`mongod`) or set MONGO_URI in `.env`.

### 2. Dashboard
```bash
cd dashboard
npm install
npm run dev          # starts on :3000
```

### 3. Chrome Extension
1. Open Chrome → `chrome://extensions/`
2. Enable Developer Mode (top right)
3. Click "Load unpacked"
4. Select the `extension/` folder

## Workflow

### Add contacts
- Visit any LinkedIn profile → extension auto-detects and saves contact to backend
- Click the blue badge (bottom-right) to add them to a group instantly

### Create groups
- Dashboard → Groups → New Group
- Groups are how you segment contacts for campaigns (e.g. "PM Recruiters", "IIT Alumni")

### Create templates
- Dashboard → Templates → New Template
- Use variables: `{name}`, `{full_name}`, `{headline}`, `{company}`

### Run a campaign
- Dashboard → Campaigns → New Campaign → pick Group + Template
- Click Start → extension opens each contact's conversation and sends the message
- Extension adds a 3-5 second delay between sends (respects LinkedIn limits)

### Track replies
- Extension polls LinkedIn every 5 minutes for new conversations
- Anyone who replies gets status updated to "replied" automatically
- Dashboard → Inbox shows who replied, who's still waiting

### Quick send (popup)
- Click extension icon on any LinkedIn messaging page
- Pick a template or type a message → Send to current conversation

## LinkedIn rate limits
- Keep campaigns to <20 messages/day to avoid flags
- Don't use this on a brand new account — aged accounts (6+ months) are safer
- The extension adds randomized delays between sends to appear human

## Files
- `extension/src/content.js` — DOM interaction, sending messages, reading conversations
- `extension/src/background.js` — service worker, syncing to backend
- `backend/src/routes/` — REST API for all data
- `backend/src/models/` — MongoDB schemas
- `dashboard/src/app/` — Next.js pages (Inbox, Groups, Campaigns, Compose)
