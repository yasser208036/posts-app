import { FriendRequest } from "@prisma/client";
import { prisma } from "./prisma";
import { FriendRequestDto, OnlineUser, PublicUser } from "./types";

// A user is "online" if their last heartbeat landed within this window. Set to
// 2x the client's 30s ping interval so a single dropped ping doesn't flip a
// user offline.
const ONLINE_WINDOW_MS = 60_000;

// Projects any row that carries id/name/email down to the client-safe shape.
// passwordHash/provider/createdAt are intentionally dropped here.
function toPublicUserFromRow(user: {
  id: string;
  name: string;
  email: string;
}): PublicUser {
  return { id: user.id, name: user.name, email: user.email };
}

/**
 * Lists all users in the system except the caller, each carrying a
 * server-computed `online` flag (lastSeenAt within the freshness window).
 * Computing `online` here — against the server clock — keeps client clock skew
 * out of presence.
 */
export const listOtherUsers = async (userId: string): Promise<OnlineUser[]> => {
  const otherUsers = await prisma.user.findMany({
    where: {
      id: { not: userId },
    },
    orderBy: {
      name: "asc",
    },
  });

  const now = Date.now();
  return otherUsers.map((user) => ({
    ...toPublicUserFromRow(user),
    online:
      user.lastSeenAt != null &&
      now - user.lastSeenAt.getTime() < ONLINE_WINDOW_MS,
  }));
};

/**
 * Creates (or re-opens) a pending friend request from senderId to receiverId.
 * Upserts on the directional (senderId, receiverId) unique key so that a prior
 * request that was rejected can be re-sent: the stale "rejected" row is reset
 * to "pending" instead of colliding with the unique constraint. Re-opening also
 * refreshes createdAt so the request sorts as new in the receiver's incoming
 * list (which orders by createdAt desc). The caller (controller) is responsible
 * for rejecting self-requests and blocking sends when an active request already
 * exists in either direction.
 */
export const createFriendRequest = async (
  senderId: string,
  receiverId: string,
): Promise<FriendRequest> => {
  return prisma.friendRequest.upsert({
    where: { senderId_receiverId: { senderId, receiverId } },
    update: { status: "pending", createdAt: new Date() },
    create: {
      senderId,
      receiverId,
      status: "pending",
    },
  });
};

/**
 * Checks if there is an active (pending or accepted) friend request in either direction.
 */
export const existingActiveRequest = async (
  a: string,
  b: string,
): Promise<boolean> => {
  const activeRequestCount = await prisma.friendRequest.count({
    where: {
      status: { in: ["pending", "accepted"] },
      OR: [
        { senderId: a, receiverId: b },
        { senderId: b, receiverId: a },
      ],
    },
  });

  return activeRequestCount > 0;
};

/**
 * Lists the caller's pending incoming friend requests, newest first.
 * Enriches each request with the sender's public info.
 */
export const listIncomingRequests = async (
  receiverId: string,
): Promise<FriendRequestDto[]> => {
  const incomingRequests = await prisma.friendRequest.findMany({
    where: {
      receiverId,
      status: "pending",
    },
    include: {
      sender: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return incomingRequests.map((requestRow) => ({
    id: requestRow.id,
    status: requestRow.status as "pending",
    createdAt: requestRow.createdAt.toISOString(),
    sender: toPublicUserFromRow(requestRow.sender),
  }));
};

/**
 * Cheaply counts incoming pending requests (e.g. for notification badges).
 */
export const countIncomingRequests = async (
  receiverId: string,
): Promise<number> => {
  return prisma.friendRequest.count({
    where: {
      receiverId,
      status: "pending",
    },
  });
};

/**
 * Transitions a pending incoming request received by receiverId.
 * Scopes update strictly to status: "pending" to guarantee idemptotency and authority.
 * Returns true if updated, false if not found, not owned, or not pending.
 */
export const setRequestStatus = async (
  receiverId: string,
  id: string,
  status: "accepted" | "rejected",
): Promise<boolean> => {
  const updateResult = await prisma.friendRequest.updateMany({
    where: {
      id,
      receiverId,
      status: "pending",
    },
    data: {
      status,
    },
  });

  return updateResult.count > 0;
};

/**
 * Lists the caller's accepted friends (other party of any accepted request in either direction).
 */
export const listFriends = async (userId: string): Promise<PublicUser[]> => {
  const friendships = await prisma.friendRequest.findMany({
    where: {
      status: "accepted",
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    include: {
      sender: true,
      receiver: true,
    },
  });

  // A pair can have accepted rows in both directions (e.g. crossed requests
  // that were both accepted), so dedup by friend id.
  const byId = new Map<string, PublicUser>();
  for (const friendshipRow of friendships) {
    const friendInfo =
      friendshipRow.senderId === userId
        ? friendshipRow.receiver
        : friendshipRow.sender;
    byId.set(friendInfo.id, toPublicUserFromRow(friendInfo));
  }

  return [...byId.values()];
};

/**
 * Returns the ids of the caller's accepted friends (the other party of any
 * accepted request in either direction). Lighter than listFriends — selects
 * only the id columns — for feed scoping and comment-permission checks. Never
 * includes the caller's own id.
 */
export const friendIds = async (userId: string): Promise<string[]> => {
  const friendships = await prisma.friendRequest.findMany({
    where: {
      status: "accepted",
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    select: { senderId: true, receiverId: true },
  });

  const ids = new Set<string>();
  for (const friendshipRow of friendships) {
    ids.add(
      friendshipRow.senderId === userId
        ? friendshipRow.receiverId
        : friendshipRow.senderId,
    );
  }

  return [...ids];
};

export const listOutgoingPendingRequestIds = async (
  senderId: string,
): Promise<string[]> => {
  const rows = await prisma.friendRequest.findMany({
    where: { senderId, status: "pending" },
    select: { receiverId: true },
  });
  return rows.map((r) => r.receiverId);
};
