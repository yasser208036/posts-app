import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";
import {
  Post,
  PostInput,
  PaginatedResponse,
  FeedPost,
  Comment,
  CommentInput,
} from "../models/post.model";

@Injectable({ providedIn: "root" })
export class PostService {
  private baseUrl = `${environment.apiUrl}/posts`;

  constructor(private http: HttpClient) {}

  getAll(
    page: number = 1,
    limit: number = 10,
    filters: { title?: string; startDate?: string; endDate?: string } = {},
  ): Observable<PaginatedResponse<FeedPost>> {
    let params = new HttpParams()
      .set("page", page.toString())
      .set("limit", limit.toString());
    if (filters.title?.trim()) {
      params = params.set("title", filters.title.trim());
    }
    if (filters.startDate) {
      params = params.set("startDate", filters.startDate);
    }
    if (filters.endDate) {
      params = params.set("endDate", filters.endDate);
    }
    return this.http.get<PaginatedResponse<FeedPost>>(this.baseUrl, { params });
  }

  getOne(id: string): Observable<Post> {
    return this.http.get<Post>(`${this.baseUrl}/${id}`);
  }

  create(input: PostInput): Observable<Post> {
    return this.http.post<Post>(this.baseUrl, input);
  }

  update(id: string, input: PostInput): Observable<Post> {
    return this.http.put<Post>(`${this.baseUrl}/${id}`, input);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getComments(postId: string): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.baseUrl}/${postId}/comments`);
  }

  addComment(postId: string, input: CommentInput): Observable<Comment> {
    return this.http.post<Comment>(`${this.baseUrl}/${postId}/comments`, input);
  }

  updateComment(
    postId: string,
    commentId: string,
    body: string,
  ): Observable<Comment> {
    return this.http.put<Comment>(
      `${this.baseUrl}/${postId}/comments/${commentId}`,
      { body },
    );
  }

  deleteComment(postId: string, commentId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${postId}/comments/${commentId}`,
    );
  }
}
