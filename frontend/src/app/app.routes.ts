import { Routes } from "@angular/router";
import { PostListComponent } from "./components/post-list/post-list.component";

export const routes: Routes = [
  { path: "", component: PostListComponent },
  { path: "**", redirectTo: "" },
];
