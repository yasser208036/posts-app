import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Subscription, forkJoin, interval, of, startWith } from "rxjs";
import { catchError, switchMap } from "rxjs/operators";

import { UserService } from "../../services/user.service";
import { FriendService } from "../../services/friend.service";
import { AuthService } from "../../services/auth.service";
import { OnlineUser } from "../../models/user.model";

const POLL_INTERVAL_MS = 30_000;

@Component({
  selector: "app-online-users",
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside
      class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
    >
      <h3 class="text-sm font-bold tracking-tight text-slate-900">
        Find friends
      </h3>

      <p *ngIf="errorMessage" class="mt-3 text-xs text-rose-600">
        {{ errorMessage }}
      </p>

      <p
        *ngIf="!loading && !users.length && !errorMessage"
        class="mt-3 text-xs text-slate-400"
      >
        No one else is online.
      </p>

      <ul class="mt-3 space-y-2">
        <li
          *ngFor="let user of users"
          class="flex items-center justify-between gap-2"
        >
          <span class="flex min-w-0 items-center gap-2">
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              [ngClass]="user.online ? 'bg-emerald-500' : 'bg-slate-300'"
            ></span>
            <span class="truncate text-sm font-medium text-slate-700">{{
              user.name
            }}</span>
          </span>
          <button
            type="button"
            (click)="addFriend(user.id)"
            [disabled]="buttonDisabled(user.id)"
            class="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed"
            [ngClass]="
              buttonDisabled(user.id)
                ? 'bg-slate-100 text-slate-400'
                : 'bg-indigo-600 text-white hover:bg-indigo-500'
            "
          >
            {{ buttonLabel(user.id) }}
          </button>
        </li>
      </ul>
    </aside>
  `,
})
export class OnlineUsersComponent implements OnInit, OnDestroy {
  users: OnlineUser[] = [];
  loading = false;
  errorMessage = "";

  private currentUserId: string | null = null;
  private friendIds = new Set<string>();
  private requestedIds = new Set<string>();
  private sub?: Subscription;

  constructor(
    private userService: UserService,
    private friendService: FriendService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.sub = new Subscription();
    this.sub.add(
      this.auth.user$.subscribe((u) => (this.currentUserId = u?.id ?? null)),
    );
    this.loading = true;
    this.sub.add(
      interval(POLL_INTERVAL_MS)
        .pipe(
          startWith(0),
          // Stamp presence as part of the stream (best-effort: a failed ping is
          // swallowed so it never breaks the poll), then fetch users + friends.
          switchMap(() =>
            this.userService.ping().pipe(
              catchError(() => of(void 0)),
              switchMap(() =>
                forkJoin({
                  users: this.userService.listUsers(),
                  friends: this.friendService.listFriends(),
                  sentIds: this.friendService.listSentRequestIds(),
                }),
              ),
              // Catch inside switchMap so a failed poll doesn't terminate the
              // interval — the next tick retries. null signals "keep last list".
              catchError(() => of(null)),
            ),
          ),
        )
        .subscribe((result) => {
          this.loading = false;
          if (!result) {
            this.errorMessage = "Couldn't refresh online users.";
            return;
          }
          this.friendIds = new Set(result.friends.map((f) => f.id));
          this.requestedIds = new Set(result.sentIds);
          this.users = result.users.filter((u) => u.id !== this.currentUserId);
          this.errorMessage = "";
        }),
    );
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  buttonDisabled(userId: string): boolean {
    return this.friendIds.has(userId) || this.requestedIds.has(userId);
  }

  buttonLabel(userId: string): string {
    if (this.friendIds.has(userId)) return "Friends";
    if (this.requestedIds.has(userId)) return "Requested";
    return "Add friend";
  }

  addFriend(userId: string): void {
    this.friendService.sendRequest(userId).subscribe({
      next: () => this.requestedIds.add(userId),
      // 409 means a request already exists — the same "Requested" end state.
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          this.requestedIds.add(userId);
        } else {
          this.errorMessage = "Couldn't send the request.";
        }
      },
    });
  }
}
