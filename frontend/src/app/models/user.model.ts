export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

// A listable user plus the server-computed presence flag (GET /api/users).
export interface OnlineUser {
  id: string;
  name: string;
  email: string;
  online: boolean;
}

// An accepted friend (GET /api/friends) — same public shape as AuthUser.
export type Friend = AuthUser;

// A pending incoming friend request (GET /api/friends/requests), enriched with
// the sender's public info for the notifications dropdown.
export interface FriendRequest {
  id: string;
  sender: AuthUser; // { id, name, email }
  createdAt: string;
}

// One item in the unified notifications feed (GET /api/notifications).
export type Notification =
  | {
      kind: "friend_request";
      id: string;
      createdAt: string;
      actor: AuthUser;
    }
  | {
      kind: "comment" | "reply";
      id: string;
      createdAt: string;
      actor: AuthUser;
      postId: string;
      commentId: string;
      parentId: string | null;
      postTitle: string;
      targetName: string | null;
      snippet: string;
    };
