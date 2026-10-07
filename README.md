# ELM Team Hub

A lightweight web tool for handovers, test URLs, team status, notes and a daily to-do list.
It runs in any browser with no installation, server or build step.

## How to run

Open `index.html` in Chrome, Edge or Firefox (double-click it). That's it.

To share it with the team, you can host the folder on any static web server
(for example an internal IIS/Nginx site or GitHub Pages).

## Features

| Page | What you can do |
|------|-----------------|
| **Dashboard** | Today's task progress, open handovers, team availability, pinned notes, quick-add task |
| **Handovers** | Record handovers: system, from → to, date, priority, ticket, details, links. Filter by status (Pending / In Progress / Completed / Blocked) and change status inline |
| **Test URLs** | Store test links per environment (DEV, SIT, UAT, Staging, Pre-Prod, PROD) with test user and notes. One-click **Open**, **Copy URL**, **Copy user** |
| **Team Status** | Each member's availability (Available, Busy, In Meeting, On Leave, Offline), handover status, current task, backup person, return date |
| **To-Do** | Daily task list with priority, due date, category. Filters: Today / Upcoming / No date / Completed / All. Overdue tasks are highlighted |
| **Notes** | Color-coded notes, pin important ones to the top |

Also: search on every page, dark mode, mobile-friendly layout, and **Export / Import** (JSON backup).

## Where is my data stored?

By default, data is saved inside your browser (localStorage) on your own computer. Nothing is sent to any server.

### Save your data to a file in your folder (recommended, Chrome or Edge)

1. Click the **"Saved in this browser only"** box at the bottom of the sidebar.
2. Click **Create a new data file**, go to your ELM Team Hub folder (next to `index.html`) and click **Save**.
   The file is called `elm-team-hub-data.json`.
3. When asked, allow the page to edit the file.

From now on every change is saved to that file automatically. The sidebar shows **"Saving to elm-team-hub-data.json"** with the last saved time.

- When you open the tool again, the browser may ask for permission: click **Reconnect** in the yellow bar at the top.
- On another computer, copy the folder and use **Open an existing data file** to pick `elm-team-hub-data.json`.
- If you moved or renamed the file, click the sidebar box and choose the file again.
- Keeping the folder in OneDrive gives you automatic cloud backup.

### Export / Import (backups)

- **Export** (bottom of the sidebar) downloads a backup file such as `elm-team-hub-backup-2026-10-07.json` to your Downloads folder.
- **Import** loads a backup and replaces the current data.
- Avoid storing passwords in the tool; store the test username only.

## Company logo

`assets/elm-logo.svg` holds the official ELM logo. To change it, replace that file
and keep the same file name (or update the two `elm-logo.svg` references in `index.html` if you use a PNG).

## Project structure

```
index.html          App shell and layout
css/styles.css      Styling (light and dark themes, responsive)
js/app.js           Application logic and storage
assets/elm-logo.svg Logo (replace with the official one)
```
