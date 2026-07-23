export interface Post {
  id: string;
  title: string;
  body: string;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
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

export interface Author {
  id: string;
  name: string;
  email: string;
}

// A post in the friends' feed carries its author for display.
export interface FeedPost extends Post {
  author: Author;
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  parentId: string | null;
  author: Author;
}

export interface CommentInput {
  body: string;
  parentId?: string;
}
