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

Data is saved in your browser's local storage on your own computer. Nothing is sent to any server.

- Use **Export** regularly to download a backup file.
- Use **Import** to restore a backup or move your data to another computer or browser.
- Clearing browser data will erase it, so keep backups.
- Avoid storing passwords in the tool; store the test username only.

## Company logo

`assets/elm-logo.svg` is a **placeholder** wordmark. To use the official ELM logo,
replace that file with the official logo, keeping the same file name
(or update the `src` in `index.html` if you use a PNG).

## Project structure

```
index.html          App shell and layout
css/styles.css      Styling (light and dark themes, responsive)
js/app.js           Application logic and storage
assets/elm-logo.svg Logo (replace with the official one)
```
