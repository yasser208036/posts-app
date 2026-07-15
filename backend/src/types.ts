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
