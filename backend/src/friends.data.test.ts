import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const prismaMock: any = {
  friendRequest: {
    count: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
};

jest.mock("./prisma", () => ({ prisma: prismaMock }));

import {
  existingActiveRequest,
  listFriends,
  listOtherUsers,
  setRequestStatus,
} from "./friends.data";

describe("friends.data", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps accepted friendships to the non-caller party", async () => {
    prismaMock.friendRequest.findMany.mockResolvedValue([
      {
        senderId: "user-1",
        receiverId: "user-2",
        sender: { id: "user-1", name: "Alice", email: "alice@example.com" },
        receiver: { id: "user-2", name: "Bob", email: "bob@example.com" },
      },
    ]);

    const friends = await listFriends("user-1");

    expect(friends).toEqual([
      { id: "user-2", name: "Bob", email: "bob@example.com" },
    ]);
  });

  it("returns false when the request is not pending for the receiver", async () => {
    prismaMock.friendRequest.updateMany.mockResolvedValue({ count: 0 });

    const changed = await setRequestStatus("user-2", "request-1", "accepted");

    expect(changed).toBe(false);
  });

  it("detects active requests in either direction", async () => {
    prismaMock.friendRequest.count.mockResolvedValue(1);

    const exists = await existingActiveRequest("user-1", "user-2");

    expect(exists).toBe(true);
  });

  it("marks a fresh lastSeenAt as online and a stale/null one as offline", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "fresh",
        name: "Fresh",
        email: "fresh@example.com",
        lastSeenAt: new Date(),
      },
      {
        id: "stale",
        name: "Stale",
        email: "stale@example.com",
        lastSeenAt: new Date(Date.now() - 120_000),
      },
      {
        id: "never",
        name: "Never",
        email: "never@example.com",
        lastSeenAt: null,
      },
    ]);

    const users = await listOtherUsers("user-1");

    expect(users).toEqual([
      { id: "fresh", name: "Fresh", email: "fresh@example.com", online: true },
      { id: "stale", name: "Stale", email: "stale@example.com", online: false },
      { id: "never", name: "Never", email: "never@example.com", online: false },
    ]);
  });
});
