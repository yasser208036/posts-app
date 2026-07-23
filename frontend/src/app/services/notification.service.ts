import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";
import { Notification } from "../models/user.model";

@Injectable({ providedIn: "root" })
export class NotificationService {
  private baseUrl = `${environment.apiUrl}/notifications`;

  constructor(private http: HttpClient) {}

  list(): Observable<Notification[]> {
    return this.http.get<Notification[]>(this.baseUrl);
  }

  // Dismisses a comment/reply notification (by its comment id) so it stops
  // appearing in the feed after the user opens it.
  dismissComment(commentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/comments/${commentId}`);
  }
}
