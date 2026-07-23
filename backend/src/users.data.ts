import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { AuthProvider, PublicUser, User } from "./types";

// Prisma returns Date for createdAt and a plain string for provider; the app
// contract is an ISO string and the AuthProvider union. Use the generated
// payload type so a new schema column surfaces here as an error rather than
// being silently dropped.
function toUser(row: Prisma.UserGetPayload<{}>): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    provider: row.provider as AuthProvider,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
  };
}

export const findUserByEmail = async (email: string): Promise<User | null> => {
  const row = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  return row ? toUser(row) : null;
};

export const findUserById = async (id: string): Promise<User | null> => {
  const row = await prisma.user.findUnique({ where: { id } });
  return row ? toUser(row) : null;
};

// Stamps the caller's lastSeenAt to now; drives online presence.
export const touchLastSeen = async (id: string): Promise<void> => {
  await prisma.user.update({ where: { id }, data: { lastSeenAt: new Date() } });
};

export const createUser = async (input: {
  name: string;
  email: string;
  passwordHash: string | null;
  provider: AuthProvider;
}): Promise<User> => {
  const row = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      provider: input.provider,
    },
  });
  return toUser(row);
};

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
});

export const clearLastSeen = async (id: string): Promise<void> => {
  await prisma.user.update({ where: { id }, data: { lastSeenAt: null } });
};
