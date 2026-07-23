import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subscription, interval, of, startWith } from "rxjs";
import { catchError, switchMap } from "rxjs/operators";
import { FriendService } from "../../services/friend.service";
import { Friend } from "../../models/user.model";
import { FriendEventsService } from "../../services/friend-events.service";

const POLL_INTERVAL_MS = 30_000;

@Component({
  selector: "app-friends-list",
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside
      class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
    >
      <h3 class="text-sm font-bold tracking-tight text-slate-900">Friends</h3>

      <p *ngIf="errorMessage" class="mt-3 text-xs text-rose-600">
        {{ errorMessage }}
      </p>

      <p
        *ngIf="!loading && !friends.length && !errorMessage"
        class="mt-3 text-xs text-slate-400"
      >
        No friends yet.
      </p>

      <ul class="mt-3 space-y-2">
        <li
          *ngFor="let friend of friends"
          class="truncate text-sm font-medium text-slate-700"
        >
          {{ friend.name }}
        </li>
      </ul>
    </aside>
  `,
})
export class FriendsListComponent implements OnInit, OnDestroy {
  friends: Friend[] = [];
  loading = false;
  errorMessage = "";

  private sub?: Subscription;

  constructor(
    private friendService: FriendService,
    private friendEvents: FriendEventsService,
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.sub = new Subscription();
    this.sub.add(
      interval(POLL_INTERVAL_MS)
        .pipe(
          startWith(0),
          // Catch inside switchMap so a failed poll doesn't terminate the
          // interval — the next tick retries. null signals "keep last list".
          switchMap(() =>
            this.friendService.listFriends().pipe(catchError(() => of(null))),
          ),
        )
        .subscribe((friends) => this.applyFriends(friends)),
    );
    this.sub.add(
      this.friendEvents.accepted$.subscribe(() => this.refreshFriends()),
    );
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private refreshFriends(): void {
    this.friendService
      .listFriends()
      .subscribe((friends) => this.applyFriends(friends));
  }

  private applyFriends(friends: Friend[] | null): void {
    this.loading = false;
    if (!friends) {
      this.errorMessage = "Couldn't refresh friends.";
      return;
    }
    this.friends = friends;
    this.errorMessage = "";
  }
}
