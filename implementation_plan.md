# Implementation Plan: Company Groups, Connection Sync & ML Pipeline

## Goal
Enhance the CRM extension and backend to support automatic company groups, manual company naming, inline profile saving, and LinkedIn connection status tracking. Additionally, implement a fully functional Pipeline where "Connected" is an actionable step for campaign triggers, and utilize the existing local **ML Intent Classifier** to auto-route prospects based on their chat responses (with a manual validation fallback).

## Proposed Changes

### 1. Backend: ML Intent Routing & Models
- **Contact Model**: Add `connection_sent`, `connected`, and `manual_validation` to the `status` enum.
- **ML Confidence Threshold**: In `messages.js`, update the ML call to check `mlData.confidence`. If the confidence is below `0.70`, route the contact to the new `manual_validation` status instead of guessing the intent.
- **Dynamic Status Updates**: Currently, the backend hardcodes `status: 'replied'` upon any reply. I will change this to dynamically apply the ML model's `recommended_stage` (or `manual_validation`).
- **Auto Company Groups**: In `companies.js`, when a company is upserted, automatically create a CRM `Group` with the same `name` (if it doesn't already exist) and associate the `Company` with it.

### 2. Extension: Popup UI & Content Widgets
- **Context Bar Updates (Popup)**: 
  - Change the `ctx-name` to be an `<input>` field so you can manually edit Company or Person names before saving, keeping your templates clean from messy LinkedIn titles.
  - Add a **Connection Status Indicator** for profile pages (e.g., "1st Degree", "Pending", "Not Connected").
  - Add an **"Update to Connected"** button to quickly change the CRM status of the current profile to `connected`.
  - Automatically pre-select the relevant Company Group in the popup dropdown when opening a Profile page.
- **Sync Inbox Button (Popup)**: Add a "Sync Chats & Run ML" button to instantly fetch the latest LinkedIn chats, send them to the backend, run the ML intent classifier, and update the pipeline (instead of waiting for background polling).
- **Inline Profile Saving (LinkedIn DOM)**: Replace the old floating profile badge (which opens a new tab) with an inline widget. This lets you add the person to a group and campaign seamlessly right on the LinkedIn page.

### 3. Dashboard: Pipeline Management UI
- **Pipeline Kanban (`/pipeline`)**: Redesign the UI to act as a functional Kanban board/funnel featuring stages like:
  1. **New / Connected**: View new and connected contacts.
  2. **Campaign Sent**: Contacts who received the message.
  3. **Manual Validation**: Contacts whose reply confused the ML model (requires human review).
  4. **Interested / Meeting / Not Interested**: Auto-routed stages based on ML results.
- **Trigger Campaigns**: Add a mechanism allowing you to select a Campaign and hit an "Execute Campaign" button directly from the "Connected" stage column, moving those prospects into the active messaging queue.

## User Review Required
> [!IMPORTANT]
> - **CRM Statuses vs Intents:** The existing Python ML service maps intents to standard CRM stages (`replied` or `not_replied`). Would you like me to expand the `Contact.status` enum to explicitly include these exact intents (e.g., `interested`, `not_interested`, `ooo`) so the Pipeline board reflects them directly?
> - **Triggering Messages Workflow:** Selecting a campaign from the Pipeline for the "Connected" stage will queue them up, and the Chrome extension will then process the queue and send the messages. Does this workflow align with your expectations?
> - **Inline Saving:** Replacing the "new tab redirect" with an inline dropdown form on the profile page will fix the redirect issue smoothly. Do you approve?

## Verification Plan
1. **Companies**: Visit a company page, rename it in the popup or inline widget, save it, and verify a CRM Group is created with the custom name.
2. **People & Connections**: Visit a 1st-degree connection profile, verify the inline widget allows saving without redirects, check that the popup says "Connected", click "Update to Connected", and ensure the CRM reflects this.
3. **Pipeline UI & Triggers**: Go to the Pipeline page, view the new Kanban columns ("Connected", "Manual Validation"). Select a campaign for "Connected" contacts and ensure they are queued for sending.
4. **Extension Sync & ML Classifier**: Click "Sync Chats & Run ML" in the popup. Watch contacts automatically move to appropriate Pipeline stages based on their chat intent (or to Manual Validation if the reply is ambiguous).
