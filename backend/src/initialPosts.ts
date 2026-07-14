import { randomUUID } from "crypto";
import { Post } from "./types";

export const initialPosts: Post[] = Array.from({ length: 50 }, (_, i) => {
  const index = i + 1;
  const now = new Date(Date.now() - (50 - index) * 3600000).toISOString(); // stagger creation times by an hour to make them realistic
  return {
    id: randomUUID(),
    title: `Post #${index}: Exploring the Wonders of TypeScript`,
    body: `This is the body content for post number ${index}. TypeScript brings static typing to JavaScript, helping us write cleaner and more maintainable code. Here is some dummy text to make the post feel complete and detailed.`,
    createdAt: now,
    updatedAt: now,
  };
});
