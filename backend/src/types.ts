export interface Post {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostInput {
  title: string;
  body: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface PostFilters {
  title?: string;
  startDate?: string; // YYYY-MM-DD (inclusive, start of day UTC)
  endDate?: string; // YYYY-MM-DD (inclusive, end of day UTC)
}

export type AuthProvider = "local" | "google";

export interface User {
  id: string;
  name: string;
  email: string; // stored lowercased
  passwordHash: string | null; // null for google-only accounts
  provider: AuthProvider; // how the account was first created
  createdAt: string;
}

// User shape safe to return to clients — never includes passwordHash.
export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
}
