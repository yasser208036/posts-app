export interface Post {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  userId: string; // owner (FK to User.id)
}

export interface PostInput {
  title: string;
  body: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PostFilters {
  title?: string;
  startDate?: string; // YYYY-MM-DD (inclusive, start of day, local time)
  endDate?: string; // YYYY-MM-DD (inclusive, end of day, local time)
}

export type AuthProvider = "local" | "google";

export interface User {
  id: string;
  name: string;
  email: string; // stored lowercased
  passwordHash: string | null; // null for google-only accounts
  provider: AuthProvider; // how the account was first created
  createdAt: string;
  lastSeenAt: string | null; // ISO timestamp of last heartbeat, or null if never
}

// User shape safe to return to clients — never includes passwordHash.
export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

// PublicUser plus a server-computed presence flag (lastSeenAt within window).
export interface OnlineUser extends PublicUser {
  online: boolean;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
}

export type FriendRequestStatus = "pending" | "accepted" | "rejected";

// Incoming-request row enriched with the sender's public info for the UI.
export interface FriendRequestDto {
  id: string;
  status: FriendRequestStatus;
  createdAt: string;
  sender: PublicUser;
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  authorId: string; // for the client edit/delete author gate
  parentId: string | null; // null = top-level; else the comment it replies to
  author: PublicUser; // { id, name, email }
}

export interface CommentInput {
  body: string;
  parentId?: string; // present → the new comment is a reply
}

// A post in the friends' feed carries its author for display.
export interface FeedPost extends Post {
  author: PublicUser;
}

// A single item in the unified notifications feed (GET /api/notifications).
export type NotificationDto =
  | {
      kind: "friend_request";
      id: string;
      createdAt: string;
      actor: PublicUser;
    }
  | {
      kind: "comment" | "reply";
      id: string;
      createdAt: string;
      actor: PublicUser;
      postId: string;
      commentId: string;
      parentId: string | null;
      postTitle: string;
      targetName: string | null;
      snippet: string;
    };
