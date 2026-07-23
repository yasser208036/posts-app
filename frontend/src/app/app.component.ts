import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from "@angular/router";
import { CreatePostTriggerService } from "./services/create-post-trigger.service";
import { AuthService } from "./services/auth.service";
import { OnlineUsersComponent } from "./components/sidebars/online-users.component";
import { FriendsListComponent } from "./components/sidebars/friends-list.component";
import { NotificationsComponent } from "./components/notifications/notifications.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    OnlineUsersComponent,
    FriendsListComponent,
    NotificationsComponent,
  ],
  template: `
    <router-outlet *ngIf="isAuthPage"></router-outlet>

    <div *ngIf="!isAuthPage" class="min-h-screen flex flex-col bg-slate-50">
      <!-- Premium Glassmorphism Navbar -->
      <header
        class="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md"
      >
        <div
          class="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8"
        >
          <!-- Logo / Brand Link -->
          <a
            routerLink="/"
            class="group flex min-w-0 items-center gap-2.5 transition-all"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200 transition-all group-hover:scale-105 group-hover:shadow-indigo-300"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="h-5 w-5 text-white"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                />
              </svg>
            </div>
            <div class="hidden min-w-0 flex-col sm:flex">
              <span
                class="truncate text-lg font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors"
                >PostsHub</span
              >
              <span
                class="text-2xs text-slate-400 font-medium -mt-1 tracking-wide"
                >Share Your Thoughts</span
              >
            </div>
          </a>

          <!-- Navigation Actions -->
          <div class="flex shrink-0 items-center gap-2 sm:gap-3">
            <!-- Mobile-only toggle for the "Find friends" drawer -->
            <button
              *ngIf="!isAuthPage"
              type="button"
              title="Toggle find friends"
              (click)="toggleMobileFriends()"
              aria-label="Toggle find friends panel"
              [attr.aria-expanded]="mobileFriendsOpen"
              class="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 active:scale-[0.96]"
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
                  d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                />
              </svg>
            </button>

            <!-- New Post: icon-only on mobile, icon + label on sm+ -->
            <button
              *ngIf="!isAuthPage"
              title="Create a new post"
              type="button"
              (click)="openNewPost()"
              aria-label="New Post"
              class="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-100 hover:bg-indigo-500 hover:shadow-md hover:shadow-indigo-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all duration-200 active:scale-[0.98] sm:px-4"
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
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              <span class="hidden sm:inline">New Post</span>
            </button>

            <app-notifications
              *ngIf="!isAuthPage && userName"
            ></app-notifications>

            <!-- Auth UI -->
            <div class="flex items-center gap-2 sm:gap-3">
              <ng-container *ngIf="userName; else authLinks">
                <div
                  class="hidden max-w-[8rem] truncate text-sm font-medium text-slate-700 md:block"
                >
                  {{ userName }}
                </div>
                <!-- Logout: icon-only on mobile, icon + label on sm+ -->
                <button
                  type="button"
                  title="Logout"
                  (click)="logout()"
                  aria-label="Logout"
                  class="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 sm:px-4"
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
                      d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
                    />
                  </svg>
                  <span class="hidden sm:inline">Logout</span>
                </button>
              </ng-container>

              <ng-template #authLinks>
                <a
                  routerLink="/auth"
                  class="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors sm:px-4"
                >
                  Login
                </a>
                <a
                  routerLink="/auth"
                  class="inline-flex h-10 items-center rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors sm:px-4"
                >
                  Sign up
                </a>
              </ng-template>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Layout Wrapper -->
      <main class="flex-1 pb-16 pt-8">
        <div
          class="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)_16rem] lg:px-8"
        >
          <!-- Desktop "Find friends" column (hidden on mobile; the drawer covers mobile) -->
          <app-online-users
            *ngIf="!isAuthPage"
            class="hidden lg:block lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
          ></app-online-users>
          <div class="min-w-0"><router-outlet></router-outlet></div>
          <app-friends-list
            *ngIf="!isAuthPage"
            class="hidden lg:block lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
          ></app-friends-list>
        </div>
      </main>

      <!-- Mobile "Find friends" drawer (below lg only) -->
      <div *ngIf="!isAuthPage" class="lg:hidden">
        <!-- Backdrop: fades in/out; only interactive while open -->
        <div
          class="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ease-out"
          [class.opacity-100]="mobileFriendsOpen"
          [class.opacity-0]="!mobileFriendsOpen"
          [class.pointer-events-auto]="mobileFriendsOpen"
          [class.pointer-events-none]="!mobileFriendsOpen"
          (click)="closeMobileFriends()"
        ></div>

        <!-- Sliding panel: translates in from the left with a spring-y ease -->
        <aside
          class="fixed left-0 top-0 z-50 flex h-full w-[85%] max-w-xs flex-col bg-slate-50 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          [class.translate-x-0]="mobileFriendsOpen"
          [class.-translate-x-full]="!mobileFriendsOpen"
        >
          <div
            class="flex items-center justify-between border-b border-slate-200 px-4 py-4"
          >
            <span class="text-base font-bold tracking-tight text-slate-900"
              >Find friends</span
            >
            <button
              type="button"
              (click)="closeMobileFriends()"
              aria-label="Close find friends panel"
              class="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 transition-colors active:scale-[0.94]"
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
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-4">
            <app-online-users></app-online-users>
          </div>
        </aside>
      </div>

      <!-- Minimal Footer -->
      <footer class="border-t border-slate-200/60 bg-white py-6">
        <div
          class="mx-auto max-w-5xl px-4 text-center text-sm text-slate-400 sm:px-6 lg:px-8"
        >
          <p>© 2026 PostsHub. Crafted with Angular & Tailwind CSS.</p>
        </div>
      </footer>
    </div>
  `,
})
export class AppComponent {
  userName: string | null = null;
  isAuthPage = false;
  mobileFriendsOpen = false;

  constructor(
    private createTrigger: CreatePostTriggerService,
    private router: Router,
    private auth: AuthService,
  ) {
    this.auth.user$.subscribe((u) => (this.userName = u?.name ?? null));

    // Hide the entire shell on the auth route (/auth); keep /login + /signup
    // matching so the shell doesn't flash during their redirect to /auth.
    const isAuth = (u: string) =>
      u.startsWith("/auth") ||
      u.startsWith("/login") ||
      u.startsWith("/signup");
    this.isAuthPage = isAuth(this.router.url);
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects ?? event.url;
        this.isAuthPage = isAuth(url);
        // A route change means the drawer's context is stale — close it.
        this.mobileFriendsOpen = false;
      }
    });
  }

  toggleMobileFriends(): void {
    this.mobileFriendsOpen = !this.mobileFriendsOpen;
  }

  closeMobileFriends(): void {
    this.mobileFriendsOpen = false;
  }

  openNewPost(): void {
    this.router.navigate(["/"]).then(() => this.createTrigger.open());
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(["/auth"]);
  }
}
