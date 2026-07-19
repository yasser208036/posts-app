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
