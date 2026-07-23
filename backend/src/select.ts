// The client-safe author columns used across post/comment/notification joins.
// Kept in one place so a join never accidentally selects passwordHash/provider.
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
} as const;
