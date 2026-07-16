import { Routes } from "@angular/router";
import { PostListComponent } from "./components/post-list/post-list.component";
import { authGuard } from "./guards/auth.guard";
import { LoginComponent } from "./components/login/login.component";
import { SignupComponent } from "./components/signup/signup.component";

export const routes: Routes = [
  { path: "", component: PostListComponent, canActivate: [authGuard] },
  { path: "login", component: LoginComponent },
  { path: "signup", component: SignupComponent },
  { path: "**", redirectTo: "" },
];
