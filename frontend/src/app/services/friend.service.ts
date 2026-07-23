import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";
import { Friend, FriendRequest } from "../models/user.model";

@Injectable({ providedIn: "root" })
export class FriendService {
  private baseUrl = `${environment.apiUrl}/friends`;

  constructor(private http: HttpClient) {}

  listFriends(): Observable<Friend[]> {
    return this.http.get<Friend[]>(this.baseUrl);
  }

  sendRequest(receiverId: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/requests`, { receiverId });
  }

  listIncomingRequests(): Observable<FriendRequest[]> {
    return this.http.get<FriendRequest[]>(`${this.baseUrl}/requests`);
  }

  // The receiver ids of the caller's pending outgoing requests. Used to keep
  // the "Requested" button state after a page refresh (server is the source
  // of truth instead of in-memory tracking).
  listSentRequestIds(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/requests/sent`);
  }

  acceptRequest(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/requests/${id}/accept`, {});
  }

  rejectRequest(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/requests/${id}/reject`, {});
  }
}
