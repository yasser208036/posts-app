# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/posts/search-filter/intake.md`
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
search-filter
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
I want to search posts by title and filter them by date
So that I can easily find specific posts or browse posts within a certain time range
```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
Search by Title
User can enter a keyword in the search input.
System returns posts where the title contains the entered keyword.
Search is handled from the backend API.

Filter by Date
User can select a date or date range.
System returns posts that match the selected date criteria.
Filtering is handled from the backend API.

Combined Search & Filter
User can use both search and date filter at the same time.
System returns posts that match both conditions.

Empty State
If no posts match the criteria, a message is displayed (e.g., "No posts found").

Performance
Results should be returned efficiently without noticeable delay.
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
  All search and filtering logic must be implemented on the backend.
  Frontend is responsible only for sending parameters and displaying results.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
  Endpoint supports query parameters:
  title (for search)
  date or startDate & endDate (for filtering)

## Out of scope

- What this story explicitly does **not** cover:
