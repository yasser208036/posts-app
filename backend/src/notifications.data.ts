import { NotificationDto } from "./types";
import { prisma } from "./prisma";
import { listIncomingRequests } from "./friends.data";
import { publicUserSelect } from "./select";

type CommentNotification = Extract<
  NotificationDto,
  { kind: "comment" | "reply" }
>;

type CommentWithPost = Awaited<ReturnType<typeof commentsOnOwnedPosts>>[number];

const SNIPPET_LEN = 80;
const PER_SOURCE_LIMIT = 20;

// Comment ids this user has already opened from the feed — excluded from the
// comment/reply queries so a visited notification stops surfacing.
async function dismissedCommentIds(userId: string): Promise<string[]> {
  const rows = await prisma.notificationDismissal.findMany({
    where: { userId },
    select: { commentId: true },
  });
  return rows.map((row) => row.commentId);
}

async function commentsOnOwnedPosts(userId: string, dismissedIds: string[]) {
  return prisma.comment.findMany({
    where: {
      authorId: { not: userId },
      post: { userId },
      id: { notIn: dismissedIds },
      OR: [{ parentId: null }, { parent: { authorId: { not: userId } } }],
    },

    include: {
      author: { select: publicUserSelect },
      post: { select: { id: true, title: true } },
      parent: { select: { author: { select: publicUserSelect } } },
    },
    orderBy: { createdAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
}

async function repliesToCallerComments(userId: string, dismissedIds: string[]) {
  return prisma.comment.findMany({
    where: {
      authorId: { not: userId },
      parent: { authorId: userId },
      id: { notIn: dismissedIds },
    },

    include: {
      author: { select: publicUserSelect },
      post: { select: { id: true, title: true } },
      parent: { select: { author: { select: publicUserSelect } } },
    },
    orderBy: { createdAt: "desc" },
    take: PER_SOURCE_LIMIT,
  });
}

export async function listNotifications(
  userId: string,
): Promise<NotificationDto[]> {
  const dismissedIds = await dismissedCommentIds(userId);
  const [requests, comments, replies] = await Promise.all([
    listIncomingRequests(userId),
    commentsOnOwnedPosts(userId, dismissedIds),
    repliesToCallerComments(userId, dismissedIds),
  ]);

  const requestNotifications: NotificationDto[] = requests.map((request) => ({
    kind: "friend_request",
    id: request.id,
    createdAt: request.createdAt,
    actor: request.sender,
  }));

  const commentNotifications = comments.map((comment) =>
    toCommentNotification(comment, "post"),
  );
  const replyNotifications: NotificationDto[] = replies.map((reply) => ({
    ...toCommentNotification(reply, "comment"),
    kind: "reply",
  }));

  return [
    ...requestNotifications,
    ...commentNotifications,
    ...replyNotifications,
  ].sort(newestFirst);
}

function toCommentNotification(
  comment: CommentWithPost,
  target: "post" | "comment",
): CommentNotification {
  return {
    kind: target === "comment" ? "reply" : "comment",
    id: comment.id,
    createdAt: comment.createdAt.toISOString(),
    actor: comment.author,
    postId: comment.postId,
    commentId: comment.id,
    parentId: comment.parentId,
    postTitle: comment.post.title,
    targetName: comment.parent?.author.name ?? null,
    snippet: comment.body.slice(0, SNIPPET_LEN),
  };
}

function newestFirst(
  leftNotification: NotificationDto,
  rightNotification: NotificationDto,
): number {
  return rightNotification.createdAt.localeCompare(leftNotification.createdAt);
}

// Marks a comment/reply notification as seen for this user. Idempotent: a
// repeat dismissal (or one for a comment that no longer exists) is a no-op.
export async function dismissCommentNotification(
  userId: string,
  commentId: string,
): Promise<void> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true },
  });
  if (!comment) return;

  await prisma.notificationDismissal.upsert({
    where: { userId_commentId: { userId, commentId } },
    create: { userId, commentId },
    update: {},
  });
}
