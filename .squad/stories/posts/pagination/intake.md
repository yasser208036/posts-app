# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/posts/pagination/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `posts`

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
As a user, I want to browse posts efficiently and view clear date information, so that I can navigate large lists easily and understand when posts were created or updated.
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
Implement server-side pagination on the list page when the total number of posts
exceeds 10.
Pagination must be handled from the backend (API), not the frontend.
Update the posts API to support pagination parameters such as:
- page (current page number)
- limit (number of posts per page, default 10)
The API response should include:
- paginated posts data
- total count of posts
- total pages (if applicable)
Update the post card to display:
- creation date
- last edited date (only if the post was edited)
Ensure the date format follows: (YYYY-MM-DD HH).
```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
Pagination is triggered only when total posts > 10.
Backend API supports pagination (page, limit).
Frontend consumes paginated API correctly.
The list page shows a maximum of 10 posts per page.
Users can navigate between pages (next/previous or page numbers).
Each post card displays the creation date clearly.
If a post is edited, the last edited date is displayed.
Dates are consistently formatted as (YYYY-MM-DD HH).
API returns:
- posts (paginated)
- total count
- pagination metadata (page, total pages)
No UI break or layout issues occur when pagination is active
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder)  | What it is       |
| ------------------------------- | ---------------- |
| _(e.g. `attachments/flow.png`)_ | _(e.g. UX flow)_ |

_(Add rows per file. If none, write "None.")_

---

## Dependencies

- **Blocked by / related ids:** (tracker ids only; optional short note)
- **Depends on code areas or other stories:**

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.
  Pagination must NOT be implemented using frontend slicing.
  All pagination logic should be handled by backend.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
  Update GET /posts endpoint to accept query params: ?page=1&limit=10
  Example response structure:
  {
  "data": [...],
  "total": 100,
  "page": 1,
  "totalPages": 10
  }

## Out of scope

- What this story explicitly does **not** cover:
  Filtering or sorting enhancements
