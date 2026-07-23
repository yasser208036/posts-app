import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Router } from "@angular/router";
import { Observable, Subscription, interval, of, startWith } from "rxjs";
import { catchError, switchMap } from "rxjs/operators";
import { FriendService } from "../../services/friend.service";
import { Notification } from "../../models/user.model";
import { NotificationService } from "../../services/notification.service";
import { NotificationNavService } from "../../services/notification-nav.service";
import { FriendEventsService } from "../../services/friend-events.service";

const POLL_INTERVAL_MS = 30_000;
type CommentNotification = Extract<Notification, { kind: "comment" | "reply" }>;

@Component({
  selector: "app-notifications",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative">
      <button
        type="button"
        title="notifications"
        (click)="toggle()"
        class="relative inline-flex items-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="h-5 w-5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        <span
          *ngIf="notifications.length > 0"
          class="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-2xs font-bold text-white"
        >
          {{ notifications.length }}
        </span>
      </button>

      <ng-container *ngIf="open">
        <div
          class="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-lg"
        >
          <div class="px-2 py-1.5">
            <h3 class="text-sm font-bold tracking-tight text-slate-900">
              Notifications
            </h3>
          </div>

          <p
            *ngIf="!notifications.length"
            class="px-2 py-3 text-sm text-slate-400"
          >
            No new notifications.
          </p>

          <ul class="space-y-1">
            <li
              *ngFor="let n of notifications; trackBy: trackById"
              class="rounded-xl px-2 py-1.5 hover:bg-slate-50"
            >
              <div *ngIf="n.kind === 'friend_request'; else commentItem">
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="min-w-0 truncate text-sm font-medium text-slate-700"
                  >
                    {{ n.actor.name }} sent you a friend request
                  </span>
                  <span class="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      (click)="accept(n)"
                      [disabled]="isPending(n.id)"
                      class="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      (click)="reject(n)"
                      [disabled]="isPending(n.id)"
                      class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 transition-colors"
                    >
                      Reject
                    </button>
                  </span>
                </div>
              </div>

              <ng-template #commentItem>
                <ng-container *ngIf="asComment(n) as commentNotification">
                  <button
                    type="button"
                    (click)="openComment(commentNotification)"
                    class="block w-full cursor-pointer rounded-xl text-left"
                  >
                    <span class="block text-sm font-medium text-slate-700">
                      {{ commentNotification.actor.name }}
                      {{
                        commentNotification.kind === "reply"
                          ? "replied to your comment"
                          : "commented on your post"
                      }}
                    </span>
                    <span
                      *ngIf="
                        commentNotification.kind === 'comment' &&
                        commentNotification.targetName
                      "
                      class="block text-xs font-medium text-indigo-600"
                    >
                      replying to {{ commentNotification.targetName }}
                    </span>
                    <span class="block text-xs text-slate-400">
                      {{ commentNotification.postTitle }}
                    </span>
                    <span class="block truncate text-xs text-slate-500">
                      {{ commentNotification.snippet }}
                    </span>
                  </button>
                </ng-container>
              </ng-template>
            </li>
          </ul>

          <p *ngIf="errorMessage" class="px-2 py-1.5 text-xs text-rose-600">
            {{ errorMessage }}
          </p>
        </div>
      </ng-container>
    </div>
  `,
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  open = false;
  errorMessage = "";

  // Ids with an accept/reject in flight, so buttons disable and double-clicks
  // don't fire the mutation twice.
  private pendingIds = new Set<string>();
  private sub?: Subscription;

  constructor(
    private friendService: FriendService,
    private notificationService: NotificationService,
    private nav: NotificationNavService,
    private friendEvents: FriendEventsService,
    private router: Router,
    private host: ElementRef<HTMLElement>,
  ) {}

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent): void {
    if (this.open && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  ngOnInit(): void {
    this.sub = interval(POLL_INTERVAL_MS)
      .pipe(
        startWith(0),
        // Catch inside switchMap so a failed poll doesn't terminate the
        // interval — the next tick retries. null signals "keep last list".
        switchMap(() =>
          this.notificationService.list().pipe(catchError(() => of(null))),
        ),
      )
      .subscribe((notifications) => {
        if (notifications) this.notifications = notifications;
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggle(): void {
    this.open = !this.open;
  }

  close(): void {
    this.open = false;
  }

  isPending(id: string): boolean {
    return this.pendingIds.has(id);
  }

  trackById(_index: number, notification: Notification): string {
    return notification.id;
  }

  asComment(notification: Notification): CommentNotification | null {
    return notification.kind === "friend_request" ? null : notification;
  }

  accept(notification: Notification): void {
    if (notification.kind !== "friend_request") return;
    this.mutate(
      notification.id,
      this.friendService.acceptRequest(notification.id),
      () => this.friendEvents.notifyAccepted(),
    );
  }

  reject(notification: Notification): void {
    if (notification.kind !== "friend_request") return;
    this.mutate(
      notification.id,
      this.friendService.rejectRequest(notification.id),
    );
  }

  openComment(notification: Notification): void {
    if (notification.kind === "friend_request") return;
    const { commentId, postId } = notification;
    this.close();
    // Optimistically drop it from the feed, then persist the dismissal so it
    // stays gone across polls. A failed call just lets the next poll restore it.
    this.remove(notification.id);
    this.notificationService.dismissComment(commentId).subscribe({
      error: () => {},
    });
    this.router
      .navigate(["/"])
      .then(() => this.nav.navigateToComment({ postId, commentId }));
  }

  // Runs an accept/reject call, dropping the request from the list on success
  // so the badge (derived from notifications.length) decrements. A stale request
  // (404/409, already handled elsewhere) is also removed — the next poll is the
  // source of truth. Other errors keep the item and show an inline message.
  private mutate(
    notificationId: string,
    call: Observable<void>,
    onSuccess?: () => void,
  ): void {
    this.pendingIds.add(notificationId);
    this.errorMessage = "";
    call.subscribe({
      next: () => {
        this.remove(notificationId);
        onSuccess?.();
      },
      error: (err: HttpErrorResponse) => {
        this.pendingIds.delete(notificationId);
        if (err.status === 404 || err.status === 409) {
          this.remove(notificationId);
        } else {
          this.errorMessage = "Couldn't update the request.";
        }
      },
    });
  }

  private remove(id: string): void {
    this.pendingIds.delete(id);
    this.notifications = this.notifications.filter(
      (notification) => notification.id !== id,
    );
  }
}
