import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const prismaMock: any = {
  post: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  comment: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock("./prisma", () => ({ prisma: prismaMock }));

import {
  addComment,
  canCommentOnPost,
  deleteComment,
  getPaginatedPosts,
  listComments,
  updateComment,
} from "./data";

const postRow = {
  id: "post-1",
  title: "Hello",
  body: "A friend's post body",
  createdAt: new Date("2026-07-20T10:00:00.000Z"),
  updatedAt: new Date("2026-07-20T10:00:00.000Z"),
  userId: "friend-1",
};

describe("canCommentOnPost", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows the caller to comment on their own post", async () => {
    prismaMock.post.findUnique.mockResolvedValue({ ...postRow, userId: "me" });

    const post = await canCommentOnPost("me", "post-1", []);

    expect(post?.userId).toBe("me");
  });

  it("allows the caller to comment on a friend's post", async () => {
    prismaMock.post.findUnique.mockResolvedValue(postRow);

    const post = await canCommentOnPost("me", "post-1", ["friend-1"]);

    expect(post?.id).toBe("post-1");
  });

  it("denies a stranger's post", async () => {
    prismaMock.post.findUnique.mockResolvedValue(postRow);

    const post = await canCommentOnPost("me", "post-1", ["someone-else"]);

    expect(post).toBeNull();
  });

  it("returns null for a missing post", async () => {
    prismaMock.post.findUnique.mockResolvedValue(null);

    const post = await canCommentOnPost("me", "missing", ["friend-1"]);

    expect(post).toBeNull();
  });
});

describe("getPaginatedPosts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("scopes the query to the caller and their friends and carries each author", async () => {
    const author = { id: "friend-1", name: "Bob", email: "bob@example.com" };
    prismaMock.post.findMany.mockResolvedValue([{ ...postRow, user: author }]);
    prismaMock.post.count.mockResolvedValue(1);

    const result = await getPaginatedPosts(["me", "friend-1"], 1, 10);

    const findManyArgs = prismaMock.post.findMany.mock.calls[0][0];
    expect(findManyArgs.where.userId).toEqual({ in: ["me", "friend-1"] });
    expect(result.total).toBe(1);
    expect(result.data[0].author).toEqual(author);
    expect(result.data[0].id).toBe("post-1");
  });

  it("applies a case-insensitive title filter", async () => {
    prismaMock.post.findMany.mockResolvedValue([]);
    prismaMock.post.count.mockResolvedValue(0);

    await getPaginatedPosts(["me"], 1, 10, { title: "  hello  " });

    const findManyArgs = prismaMock.post.findMany.mock.calls[0][0];
    expect(findManyArgs.where.title).toEqual({
      contains: "hello",
      mode: "insensitive",
    });
  });
});

describe("comments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("trims the body and returns the comment with its author", async () => {
    const author = { id: "me", name: "Alice", email: "alice@example.com" };
    prismaMock.comment.create.mockResolvedValue({
      id: "comment-1",
      body: "Nice post",
      createdAt: new Date("2026-07-20T11:00:00.000Z"),
      authorId: "me",
      parentId: null,
      author,
    });

    const comment = await addComment("post-1", "me", { body: "  Nice post  " });

    expect(prismaMock.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ body: "Nice post", parentId: null }),
      }),
    );
    expect(comment.author).toEqual(author);
    expect(comment.authorId).toBe("me");
    expect(comment.parentId).toBeNull();
    expect(comment.createdAt).toBe("2026-07-20T11:00:00.000Z");
  });

  it("lists comments oldest-first with author and nesting fields", async () => {
    prismaMock.comment.findMany.mockResolvedValue([
      {
        id: "comment-1",
        body: "First",
        createdAt: new Date("2026-07-20T11:00:00.000Z"),
        authorId: "me",
        parentId: null,
        author: { id: "me", name: "Alice", email: "alice@example.com" },
      },
    ]);

    const comments = await listComments("post-1");

    expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "asc" } }),
    );
    expect(comments[0].author.name).toBe("Alice");
    expect(comments[0].authorId).toBe("me");
    expect(comments[0].parentId).toBeNull();
  });

  it("attaches a reply to a top-level parent", async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      id: "parent-1",
      postId: "post-1",
      parentId: null,
    });
    prismaMock.comment.create.mockResolvedValue({
      id: "reply-1",
      body: "Replying",
      createdAt: new Date("2026-07-20T12:00:00.000Z"),
      authorId: "me",
      parentId: "parent-1",
      author: { id: "me", name: "Alice", email: "alice@example.com" },
    });

    await addComment("post-1", "me", {
      body: "Replying",
      parentId: "parent-1",
    });

    expect(prismaMock.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentId: "parent-1" }),
      }),
    );
  });

  it("attaches a reply-to-a-reply to the targeted reply", async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      id: "reply-1",
      postId: "post-1",
      parentId: "parent-1",
    });
    prismaMock.comment.create.mockResolvedValue({
      id: "reply-2",
      body: "Nested",
      createdAt: new Date("2026-07-20T12:30:00.000Z"),
      authorId: "me",
      parentId: "reply-1",
      author: { id: "me", name: "Alice", email: "alice@example.com" },
    });

    await addComment("post-1", "me", { body: "Nested", parentId: "reply-1" });

    expect(prismaMock.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentId: "reply-1" }),
      }),
    );
  });

  it("drops a parentId that belongs to another post", async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      id: "other-parent",
      postId: "other-post",
      parentId: null,
    });
    prismaMock.comment.create.mockResolvedValue({
      id: "comment-2",
      body: "Loose",
      createdAt: new Date("2026-07-20T13:00:00.000Z"),
      authorId: "me",
      parentId: null,
      author: { id: "me", name: "Alice", email: "alice@example.com" },
    });

    await addComment("post-1", "me", {
      body: "Loose",
      parentId: "other-parent",
    });

    expect(prismaMock.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentId: null }),
      }),
    );
  });

  it("updates a comment only when authored by the caller", async () => {
    prismaMock.comment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.comment.findUnique.mockResolvedValue({
      id: "comment-1",
      body: "Edited",
      createdAt: new Date("2026-07-20T11:00:00.000Z"),
      authorId: "me",
      parentId: null,
      author: { id: "me", name: "Alice", email: "alice@example.com" },
    });

    const updated = await updateComment("me", "comment-1", "  Edited  ");

    expect(prismaMock.comment.updateMany).toHaveBeenCalledWith({
      where: { id: "comment-1", authorId: "me" },
      data: { body: "Edited" },
    });
    expect(updated?.body).toBe("Edited");
  });

  it("returns undefined when updating a comment the caller didn't author", async () => {
    prismaMock.comment.updateMany.mockResolvedValue({ count: 0 });

    const updated = await updateComment("me", "comment-1", "Edited");

    expect(updated).toBeUndefined();
    expect(prismaMock.comment.findUnique).not.toHaveBeenCalled();
  });

  it("deletes a comment only when authored by the caller", async () => {
    prismaMock.comment.deleteMany.mockResolvedValue({ count: 1 });
    expect(await deleteComment("me", "comment-1")).toBe(true);

    prismaMock.comment.deleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteComment("me", "comment-1")).toBe(false);
  });
});
