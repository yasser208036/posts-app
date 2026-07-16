import { randomUUID } from "crypto";
import { AuthProvider, PublicUser, User } from "./types";

// In-memory mock database
let users: User[] = [];

export const findUserByEmail = (email: string): User | undefined =>
  users.find((u) => u.email === email.trim().toLowerCase());

export const findUserById = (id: string): User | undefined =>
  users.find((u) => u.id === id);

export const createUser = (input: {
  name: string;
  email: string;
  passwordHash: string | null;
  provider: AuthProvider;
}): User => {
  const user: User = {
    id: randomUUID(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash: input.passwordHash,
    provider: input.provider,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  return user;
};

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
});
