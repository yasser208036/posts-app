# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/users/users-list-friends/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `users`

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
Sidebar Users, Friend Requests, Notifications, and Friends Posts Interaction
```

---

## Description

_(Paste the full work item description. Prefilled when fetched from a tracker.)_

```
As a

registered user

I want to
See all users who are currently logged in displayed in a left sidebar
Send friend requests to other users
Receive friend requests through notifications in the header
Accept or reject friend requests
See a list of my friends in a right sidebar once they accept my requests
View my friends' posts and interact with them by adding comments
So that

I can connect with other users, manage friendships بسهولة، وأتفاعل مع المحتوى داخل المنصة
```

---

## Acceptance criteria

_(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)_

```
1. Left Sidebar (Logged-in Users)
The system displays a list of users who are currently logged in
The list appears in the left sidebar
Each user is displayed with their username

2. Send Friend Request
A user can send a friend request to any other user
A user cannot send a request to themselves
A user cannot send duplicate friend requests

3. Notifications in Header (Friend Requests)
Incoming friend requests are displayed as notifications in the header
A notification icon shows the number of pending requests
When the user clicks the notification icon:
A dropdown list of friend requests is displayed
Each notification includes:
Sender name
Action buttons (Accept / Reject)

4. Accept & Reject Friend Requests
A user can accept or reject friend requests directly from the notification dropdown
When accepted:
A friendship relationship is created
The notification is removed or marked as handled

5. Right Sidebar (Friends List)
The system displays a list of accepted friends
The list appears in the right sidebar
The list updates immediately after a request is accepted

6. View Friends' Posts
A user can view posts created by their friends only
Each post must display:
The author's name
The post content

7. Comment on Posts
A user can add comments to their friends' posts
Comments appear under the related post
Each comment includes:
The comment author's name
The comment content

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
  Real-time notifications using WebSockets
  Online/offline status indicator
  Notification read/unread state
  Toast alerts for new friend requests

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
