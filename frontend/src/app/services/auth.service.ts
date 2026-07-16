import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, Observable, tap } from "rxjs";
import { environment } from "../../environments/environment";
import { AuthResponse, AuthUser } from "../models/user.model";

const TOKEN_KEY = "posts_auth_token";
const USER_KEY = "posts_auth_user";

@Injectable({ providedIn: "root" })
export class AuthService {
  private baseUrl = `${environment.apiUrl}/auth`;
  private tokenValue: string | null = localStorage.getItem(TOKEN_KEY);

  private userSubject = new BehaviorSubject<AuthUser | null>(
    this.readStoredUser(),
  );

  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {}

  get token(): string | null {
    return this.tokenValue;
  }

  get isAuthenticated(): boolean {
    return !!this.tokenValue;
  }

  signup(body: {
    name: string;
    email: string;
    password: string;
  }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/signup`, body)
      .pipe(tap((res) => this.persist(res)));
  }

  login(body: { email: string; password: string }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, body)
      .pipe(tap((res) => this.persist(res)));
  }

  googleLogin(credential: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/google`, { credential })
      .pipe(tap((res) => this.persist(res)));
  }

  logout(): void {
    this.tokenValue = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.userSubject.next(null);
  }

  private persist(res: AuthResponse): void {
    this.tokenValue = res.token;
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this.userSubject.next(res.user);
  }

  private readStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }
}
