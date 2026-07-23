import { Routes } from "@angular/router";
import { PostListComponent } from "./components/post-list/post-list.component";
import { authGuard } from "./guards/auth.guard";
import { AuthPageComponent } from "./components/auth-page/auth-page.component";

export const routes: Routes = [
  { path: "", component: PostListComponent, canActivate: [authGuard] },
  { path: "auth", component: AuthPageComponent },
  { path: "login", redirectTo: "auth", pathMatch: "full" },
  { path: "signup", redirectTo: "auth", pathMatch: "full" },
  { path: "**", redirectTo: "" },
];
