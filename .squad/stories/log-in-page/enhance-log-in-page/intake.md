# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/log-in-page/enhance-log-in-page/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `log-in-page`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `` _(used in filenames and plan tables; fill manually if empty)_
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

_(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)_

```
Unified Authentication Page (Login & Sign Up)
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
As a User

I want

to access both Login and Sign Up in a single page with an easy way to switch between them

So that

I can authenticate quickly without navigating between multiple pages

```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
Remove Navbar
The Navbar should not be visible on the Authentication page
The page should be displayed in a full-screen layout

Merge Login & Sign Up
Create a single route (e.g., /auth)
The page should contain:
Login form
Sign Up form
Only one form is visible at a time

Toggle Between Forms
Provide buttons or tabs:
Login
Sign Up
Clicking on each option should:
Switch the displayed form
Not trigger a page reload
Optional: add a smooth animation (fade/slide)

Split Screen Layout
The page should be divided into two sections:
Right Section (Branding)
Contains:
Logo
Website title
Short description of the platform
Content should be centered (vertically & horizontally)
Styled with a distinct background (color, gradient, or image)

Left Section (Form)
Displays:
Login form OR Sign Up form
Includes:
Input fields
Submit button
Switch option (Login / Sign Up)

Responsive Design
On smaller screens (mobile/tablet):
show Form section only and hide Branding
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder)  | What it is       |
| ------------------------------- | ---------------- |
| _(e.g. `attachments/flow.png`)_ | _(e.g. UX flow)_ |

_(Add rows per file. If none, write "None.")_

"attachments/Screenshot from 2026-07-21 10-01-09.png"

---

## Dependencies

- **Blocked by / related ids:** (tracker ids only; optional short note)
- **Depends on code areas or other stories:**

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
