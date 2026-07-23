import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LoginComponent } from "../login/login.component";
import { SignupComponent } from "../signup/signup.component";

type AuthMode = "login" | "signup";

@Component({
  selector: "app-auth-page",
  standalone: true,
  imports: [CommonModule, LoginComponent, SignupComponent],
  templateUrl: "./auth-page.component.html",
})
export class AuthPageComponent {
  mode: AuthMode = "login";

  setMode(mode: AuthMode): void {
    this.mode = mode;
  }
}
