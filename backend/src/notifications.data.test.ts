import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const prismaMock: any = {
  comment: {
    findMany: jest.fn(),
  },
  friendRequest: {
    findMany: jest.fn(),
  },
  notificationDismissal: {
    findMany: jest.fn(),
  },
};

jest.mock("./prisma", () => ({ prisma: prismaMock }));

import { listNotifications } from "./notifications.data";

describe("notifications.data", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: nothing dismissed. Individual tests override as needed.
    prismaMock.notificationDismissal.findMany.mockResolvedValue([]);
  });

  it("merges requests, comments, and replies newest first", async () => {
    prismaMock.friendRequest.findMany.mockResolvedValue([
      {
        id: "request-1",
        status: "pending",
        createdAt: new Date("2026-07-22T09:00:00.000Z"),
        sender: { id: "user-2", name: "Alice", email: "alice@example.com" },
      },
    ]);
    prismaMock.comment.findMany
      .mockResolvedValueOnce([
        commentRow({
          id: "comment-1",
          body: "Top-level comment on my post",
          createdAt: new Date("2026-07-22T10:00:00.000Z"),
          parentId: null,
        }),
        commentRow({
          id: "comment-2",
          body: "Reply on my post",
          createdAt: new Date("2026-07-22T08:00:00.000Z"),
          parentId: "comment-parent",
        }),
      ])
      .mockResolvedValueOnce([
        commentRow({
          id: "reply-1",
          body: "Reply to my comment on a friend's post",
          createdAt: new Date("2026-07-22T11:00:00.000Z"),
          parentId: "my-comment",
          postId: "friend-post",
          postTitle: "Friend Post",
        }),
        commentRow({
          id: "reply-2",
          body: "Reply to my comment on my post",
          createdAt: new Date("2026-07-22T12:00:00.000Z"),
          parentId: "my-comment-2",
          postId: "my-post",
          postTitle: "My Post",
        }),
      ]);

    const notifications = await listNotifications("user-1");

    expect(notifications.map((notification) => notification.id)).toEqual([
      "reply-2",
      "reply-1",
      "comment-1",
      "request-1",
      "comment-2",
    ]);
    expect(notifications.map((notification) => notification.kind)).toEqual([
      "reply",
      "reply",
      "comment",
      "friend_request",
      "comment",
    ]);
  });

  it("queries only comments authored by other users", async () => {
    prismaMock.friendRequest.findMany.mockResolvedValue([]);
    prismaMock.comment.findMany.mockResolvedValue([]);

    await listNotifications("user-1");

    expect(prismaMock.comment.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ authorId: { not: "user-1" } }),
      }),
    );
    expect(prismaMock.comment.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ authorId: { not: "user-1" } }),
      }),
    );
  });

  it("adds parent author context for nested comment notifications", async () => {
    prismaMock.friendRequest.findMany.mockResolvedValue([]);
    prismaMock.comment.findMany
      .mockResolvedValueOnce([
        commentRow({
          id: "comment-1",
          parentId: "parent-1",
          postTitle: "My Post",
          parentName: "Bob",
        }),
      ])
      .mockResolvedValueOnce([]);

    const notifications = await listNotifications("user-1");

    expect(notifications[0]).toMatchObject({
      kind: "comment",
      targetName: "Bob",
    });
  });

  it("maps comment metadata and truncates snippets", async () => {
    prismaMock.friendRequest.findMany.mockResolvedValue([]);
    prismaMock.comment.findMany
      .mockResolvedValueOnce([
        commentRow({
          body: "x".repeat(90),
          postId: "post-9",
          postTitle: "Mapped Post",
        }),
      ])
      .mockResolvedValueOnce([]);

    const notifications = await listNotifications("user-1");

    expect(notifications[0]).toMatchObject({
      kind: "comment",
      postId: "post-9",
      postTitle: "Mapped Post",
      snippet: "x".repeat(80),
    });
  });

  it("excludes dismissed comment ids from both comment queries", async () => {
    prismaMock.friendRequest.findMany.mockResolvedValue([]);
    prismaMock.comment.findMany.mockResolvedValue([]);
    prismaMock.notificationDismissal.findMany.mockResolvedValue([
      { commentId: "seen-1" },
      { commentId: "seen-2" },
    ]);

    await listNotifications("user-1");

    expect(prismaMock.comment.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: ["seen-1", "seen-2"] },
        }),
      }),
    );
    expect(prismaMock.comment.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: ["seen-1", "seen-2"] },
        }),
      }),
    );
  });
});

function commentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "comment-1",
    body: "Comment body",
    createdAt: new Date("2026-07-22T10:00:00.000Z"),
    authorId: "user-2",
    postId: "post-1",
    parentId: null,
    author: { id: "user-2", name: "Alice", email: "alice@example.com" },
    ...overrides,
    post: {
      id: overrides.postId ?? "post-1",
      title: overrides.postTitle ?? "Post Title",
    },
    parent: overrides.parentName
      ? {
          author: {
            id: "parent-author",
            name: overrides.parentName,
            email: "parent@example.com",
          },
        }
      : null,
  };
}
