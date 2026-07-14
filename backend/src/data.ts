import { randomUUID } from "crypto";
import { Post, PostInput } from "./types";
import { initialPosts } from "./initialPosts";

// In-memory mock database
let posts: Post[] = [...initialPosts];

export const getPaginatedPosts = (
  page: number,
  limit: number,
): { data: Post[]; total: number } => {
  const total = posts.length;
  const start = (page - 1) * limit;
  const data = posts.slice(start, start + limit);
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
