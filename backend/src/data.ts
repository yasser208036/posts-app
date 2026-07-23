import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  Comment,
  CommentInput,
  FeedPost,
  Post,
  PostInput,
  PostFilters,
} from "./types";
import { publicUserSelect } from "./select";

// Prisma returns Date for createdAt/updatedAt; the API contract is ISO strings.
// Use the generated payload type so a new schema column surfaces here as an error
// rather than being silently dropped.
function toPost(row: Prisma.PostGetPayload<{}>): Post {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    userId: row.userId,
  };
}

// Maps a comment row (with its joined author) to the ISO-string API shape.
function toComment(
  row: Prisma.CommentGetPayload<{
    include: { author: { select: typeof publicUserSelect } };
  }>,
): Comment {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    authorId: row.authorId,
    parentId: row.parentId,
    author: row.author,
  };
}

// Parse a YYYY-MM-DD string into a local-time Date at either the start or end of
// that day. Local time (not UTC) to match the documented date-filter semantics.
// Returns undefined for malformed input so the bound is simply skipped.
function parseLocalDate(
  value: string,
  bound: "start" | "end",
): Date | undefined {
  const [y, m, d] = value.split("-").map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return undefined;
  }
  return bound === "start"
    ? new Date(y, m - 1, d, 0, 0, 0, 0)
    : new Date(y, m - 1, d, 23, 59, 59, 999);
}

// Lists posts authored by any of `authorIds` (the caller plus their accepted
// friends), each carrying its author for display. The caller's own id is always
// included by the controller, so a user with no friends still sees their own
// posts. Title/date filters apply to the whole union.
export const getPaginatedPosts = async (
  authorIds: string[],
  page: number,
  limit: number,
  filters: PostFilters = {},
): Promise<{ data: FeedPost[]; total: number }> => {
  const term = filters.title?.trim();

  // Local-time aware inclusive bounds — identical semantics to the old in-memory code.
  const from = filters.startDate
    ? parseLocalDate(filters.startDate, "start")
    : undefined;
  const to = filters.endDate
    ? parseLocalDate(filters.endDate, "end")
    : undefined;

  const where: Prisma.PostWhereInput = { userId: { in: authorIds } };
  if (term) where.title = { contains: term, mode: "insensitive" };
  if (from || to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (from) createdAt.gte = from;
    if (to) createdAt.lte = to;
    where.createdAt = createdAt;
  }

  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: publicUserSelect } },
    }),
    prisma.post.count({ where }),
  ]);

  return {
    data: rows.map((row) => ({ ...toPost(row), author: row.user })),
    total,
  };
};

export const getPostById = async (
  userId: string,
  id: string,
): Promise<Post | undefined> => {
  const row = await prisma.post.findFirst({ where: { id, userId } });
  return row ? toPost(row) : undefined;
};

export const createPost = async (
  userId: string,
  input: PostInput,
): Promise<Post> => {
  const row = await prisma.post.create({
    data: { title: input.title, body: input.body, userId },
  });
  return toPost(row);
};

export const updatePost = async (
  userId: string,
  id: string,
  input: PostInput,
): Promise<Post | undefined> => {
  // Scope to owner: updateMany returns count, so we can tell "not mine" from "updated".
  const result = await prisma.post.updateMany({
    where: { id, userId },
    data: { title: input.title, body: input.body },
  });
  if (result.count === 0) return undefined;
  return getPostById(userId, id);
};

export const deletePost = async (
  userId: string,
  id: string,
): Promise<boolean> => {
  const result = await prisma.post.deleteMany({ where: { id, userId } });
  return result.count > 0;
};

// Resolves the post iff the caller may comment on it: they own it, or its owner
// is a friend. Returns null for a missing post or a stranger's post so the
// controller answers 404 either way (existence is not leaked — CLAUDE.md).
export const canCommentOnPost = async (
  userId: string,
  postId: string,
  friendIds: string[],
): Promise<Post | null> => {
  const row = await prisma.post.findUnique({ where: { id: postId } });
  if (!row) return null;
  if (row.userId !== userId && !friendIds.includes(row.userId)) return null;
  return toPost(row);
};

export const addComment = async (
  postId: string,
  authorId: string,
  input: CommentInput,
): Promise<Comment> => {
  // Keep the requested parent when it belongs to the same post so replies can
  // form a nested thread of any depth (the UI renders replies recursively).
  // Invalid/mismatched parents become top-level comments.
  const parentId = await resolveParentId(postId, input.parentId);

  const row = await prisma.comment.create({
    data: { body: input.body.trim(), postId, authorId, parentId },
    include: { author: { select: publicUserSelect } },
  });
  return toComment(row);
};

// Resolves a requested reply target, or null when the target is absent, unknown,
// or on a different post. The target is kept as-is so replies can nest to any
// depth (the UI renders the thread recursively).
async function resolveParentId(
  postId: string,
  requestedParentId: string | undefined,
): Promise<string | null> {
  if (!requestedParentId) return null;
  const parent = await prisma.comment.findUnique({
    where: { id: requestedParentId },
  });
  if (!parent || parent.postId !== postId) return null;
  return parent.id;
}

// Author-scoped edit: updateMany's count lets us distinguish "updated" from
// "not mine / missing" — the controller answers 404 for either miss so authorship
// is not leaked (CLAUDE.md 404-not-403 rule).
export const updateComment = async (
  authorId: string,
  commentId: string,
  body: string,
): Promise<Comment | undefined> => {
  const result = await prisma.comment.updateMany({
    where: { id: commentId, authorId },
    data: { body: body.trim() },
  });
  if (result.count === 0) return undefined;
  const row = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { author: { select: publicUserSelect } },
  });
  return row ? toComment(row) : undefined;
};

// Author-scoped delete. Replies cascade via the self-relation FK. Returns false
// when the comment is missing or not authored by the caller.
export const deleteComment = async (
  authorId: string,
  commentId: string,
): Promise<boolean> => {
  const result = await prisma.comment.deleteMany({
    where: { id: commentId, authorId },
  });
  return result.count > 0;
};

export const listComments = async (postId: string): Promise<Comment[]> => {
  const rows = await prisma.comment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: publicUserSelect } },
  });
  return rows.map(toComment);
};
