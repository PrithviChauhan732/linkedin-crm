# Implementation Plan: Bulk Connections Sync (Hash Map Optimized)

## Goal
To implement a high-performance "Sync Connections" feature that bulk-updates CRM contacts from the `connection_sent` stage to the `connected` stage by scraping the user's LinkedIn connections page and utilizing $O(1)$ Hash Map lookups on the backend.

## Proposed Changes

### 1. Extension UI (`popup.html` & `popup.js`)
- **Sync Connections Button**: Add a new button next to the existing "Sync Chats & ML" button.
- **Trigger Logic**: When clicked, it will open `linkedin.com/mynetwork/invite-connect/connections/` in a background tab (so as not to disrupt the user), wait for it to load, inject a scraping script, and then close the tab automatically.

### 2. Extension Scraper (`content.js` or injected script)
- **Scraping Logic**: Extract the list of recent 1st-degree connections (Name and Profile URL) from the DOM (`.mn-connection-card__link`). 
- **Send to Backend**: Transmit this array to the new backend endpoint.

### 3. Backend Routing & Reconciliation (`routes/contacts.js`)
- **New Endpoint**: `POST /api/contacts/sync-connections`
- **Hash Map Reconciliation**: 
  - Receive the array of scraped connections.
  - Build a Javascript `Map` keyed by the normalized Profile URL for $O(1)$ lookups.
  - Query the database for all contacts currently in the `connection_sent` status.
  - Filter the pending contacts to find those whose URLs exist in the Hash Map.
  - Execute a single bulk `$updateMany` (or `$in` query) to update the matched contacts to `connected`.

## User Review Required
> [!IMPORTANT]
> Because you've already approved the approach, I will begin execution immediately upon your final confirmation of this document.

## Verification Plan
1. **Scraping**: Click "Sync Connections" in the popup; verify a background tab opens briefly and closes.
2. **Backend**: Verify that pending contacts matching the scraped connections are moved to the `connected` stage in the database.
3. **Pipeline**: Check the Pipeline dashboard to ensure newly connected prospects appear in the "Connected" column.
