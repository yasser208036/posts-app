import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { Post, PostInput, PostFilters } from "./types";

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

export const getPaginatedPosts = async (
  userId: string,
  page: number,
  limit: number,
  filters: PostFilters = {},
): Promise<{ data: Post[]; total: number }> => {
  const term = filters.title?.trim();

  // Local-time aware inclusive bounds — identical semantics to the old in-memory code.
  const from = filters.startDate
    ? parseLocalDate(filters.startDate, "start")
    : undefined;
  const to = filters.endDate
    ? parseLocalDate(filters.endDate, "end")
    : undefined;

  const where: Prisma.PostWhereInput = { userId };
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
    }),
    prisma.post.count({ where }),
  ]);

  return { data: rows.map(toPost), total };
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
