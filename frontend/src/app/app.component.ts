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

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  template: `
    <div class="min-h-screen flex flex-col bg-slate-50">
      <!-- Premium Glassmorphism Navbar -->
      <header
        class="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md"
      >
        <div
          class="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8"
        >
          <!-- Logo / Brand Link -->
          <a
            routerLink="/"
            class="group flex items-center gap-2.5 transition-all"
          >
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200 transition-all group-hover:scale-105 group-hover:shadow-indigo-300"
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
            <div class="flex flex-col">
              <span
                class="text-lg font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors"
                >PostsHub</span
              >
              <span
                class="text-2xs text-slate-400 font-medium -mt-1 tracking-wide"
                >Share Your Thoughts</span
              >
            </div>
          </a>

          <!-- Navigation Actions -->
          <div class="flex items-center gap-4">
            <button
              *ngIf="!isAuthPage"
              (click)="openNewPost()"
              class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-100 hover:bg-indigo-500 hover:shadow-md hover:shadow-indigo-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all duration-200 active:scale-[0.98]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="h-4.5 w-4.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              <span>New Post</span>
            </button>

            <!-- Auth UI -->
            <div class="hidden sm:flex items-center gap-3">
              <ng-container *ngIf="userName; else authLinks">
                <div class="text-sm text-slate-700 font-medium">
                  {{ userName }}
                </div>
                <button
                  type="button"
                  (click)="logout()"
                  class="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600"
                >
                  Logout
                </button>
              </ng-container>

              <ng-template #authLinks>
                <a
                  routerLink="/login"
                  class="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  Login
                </a>
                <a
                  routerLink="/signup"
                  class="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
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
        <div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <router-outlet></router-outlet>
        </div>
      </main>

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

  constructor(
    private createTrigger: CreatePostTriggerService,
    private router: Router,
    private auth: AuthService,
  ) {
    this.auth.user$.subscribe((u) => (this.userName = u?.name ?? null));

    // Hide "New Post" on auth pages (/login, /signup)
    this.isAuthPage =
      this.router.url.startsWith("/login") ||
      this.router.url.startsWith("/signup");
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects ?? event.url;
        this.isAuthPage = url.startsWith("/login") || url.startsWith("/signup");
      }
    });
  }

  openNewPost(): void {
    this.router.navigate(["/"]).then(() => this.createTrigger.open());
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(["/login"]);
  }
}
