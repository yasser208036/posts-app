import { randomUUID } from "crypto";
import { Post, PostInput, PostFilters } from "./types";
import { initialPosts } from "./initialPosts";

// In-memory mock database
let posts: Post[] = [...initialPosts];

export const getPaginatedPosts = (
  page: number,
  limit: number,
  filters: PostFilters = {},
): { data: Post[]; total: number } => {
  const term = filters.title?.trim().toLowerCase();
  const from = filters.startDate
    ? (() => {
        const [y, m, d] = filters.startDate.split("-").map((v) => Number(v));
        if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
          return new Date("Invalid Date");
        // Local-time aware bounds (inclusive)
        return new Date(y, m - 1, d, 0, 0, 0, 0);
      })()
    : undefined;

  const to = filters.endDate
    ? (() => {
        const [y, m, d] = filters.endDate.split("-").map((v) => Number(v));
        if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
          return new Date("Invalid Date");
        // Local-time aware bounds (inclusive)
        return new Date(y, m - 1, d, 23, 59, 59, 999);
      })()
    : undefined;

  const filtered = posts.filter((p) => {
    if (term && !p.title.toLowerCase().includes(term)) return false;
    if (from || to) {
      const created = new Date(p.createdAt);
      if (from && isNaN(from.getTime())) return false;
      if (to && isNaN(to.getTime())) return false;
      if (from && created < from) return false;
      if (to && created > to) return false;
    }
    return true;
  });

  const total = filtered.length;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);
  return { data, total };
};

export const getPostById = (id: string): Post | undefined =>
  posts.find((p) => p.id === id);

export const createPost = (input: PostInput): Post => {
  const now = new Date().toISOString();
  const newPost: Post = {
    id: randomUUID(),
    title: input.title,
    body: input.body,
    createdAt: now,
    updatedAt: now,
  };
  posts.push(newPost);
  return newPost;
};

export const updatePost = (id: string, input: PostInput): Post | undefined => {
  const post = getPostById(id);
  if (!post) return undefined;
  post.title = input.title;
  post.body = input.body;
  post.updatedAt = new Date().toISOString();
  return post;
};

export const deletePost = (id: string): boolean => {
  const lengthBefore = posts.length;
  posts = posts.filter((p) => p.id !== id);
  return posts.length < lengthBefore;
};
