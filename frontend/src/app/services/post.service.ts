import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Post, PostInput, PaginatedResponse } from '../models/post.model';

@Injectable({ providedIn: 'root' })
export class PostService {
  private baseUrl = `${environment.apiUrl}/posts`;

  constructor(private http: HttpClient) {}

  getAll(page: number = 1, limit: number = 10): Observable<PaginatedResponse<Post>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this.http.get<PaginatedResponse<Post>>(this.baseUrl, { params });
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
}
