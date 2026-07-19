# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/create-data-base/create-data-base/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `create-data-base`

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
User & Posts Management using PostgreSQL and Prisma
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
As a user, I want to create an account and store my posts in a relational database so that I can securely manage and retrieve my content, with proper relationships between users and their posts.

```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
Authentication
User can sign up and log in.
Password must be hashed before storing.

Posts Management
User can:
Create post
Update post
Delete post
View only their posts

Database Requirements
System must use:
PostgreSQL as the main database
Prisma ORM for database access and schema management
Data must be persisted (not in-memory)

Relationships
One user can have many posts (One-to-Many)
Each post must belong to one user
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
  Store timestamps:
  createdAt
  updatedAt
  Ensure filtering posts by logged-in user
  Handle timezone correctly if filtering by date

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
