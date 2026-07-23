import {
  Component,
  AfterViewInit,
  OnDestroy,
  EventEmitter,
  Output,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../../services/auth.service";
import { environment } from "../../../environments/environment";
import { trimmedMinLength } from "../../utils/validators";
import {
  isGoogleClientIdPlaceholder,
  initializeGoogleSignIn,
} from "../../utils/google-auth";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./login.component.html",
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  @Output() switchMode = new EventEmitter<void>();
  errorMessage = "";
  form = this.fb.group({
    email: ["", [Validators.required, Validators.email]],
    password: ["", [Validators.required]],
  });

  submitting = false;
  serverErrors: Record<string, string> = {};
  private cleanupGis: (() => void) | null = null;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngAfterViewInit(): void {
    if (isGoogleClientIdPlaceholder()) {
      console.error(
        "Google Identity Services: googleClientId is placeholder. Update frontend/src/environments/environment.ts",
      );
      this.errorMessage =
        "Google login is not available: googleClientId is a placeholder. Google login requires a valid Google OAuth Client ID.";
      return;
    }

    this.cleanupGis = initializeGoogleSignIn(
      (credential) => {
        this.auth.googleLogin(credential).subscribe({
          next: () => this.router.navigate(["/"]),
          error: (err) => {
            console.error("googleLogin error:", err);
            this.errorMessage = "Google login failed. Please try again.";
          },
        });
      },
      (err) => {
        console.error(err);
        this.errorMessage =
          "Failed to load Google Identity Services. Check your internet connection and googleClientId configuration.";
      },
    );
  }

  ngOnDestroy(): void {
    this.cleanupGis?.();
  }

  get email() {
    return this.form.controls.email;
  }

  get password() {
    return this.form.controls.password;
  }

  onSubmit(): void {
    this.serverErrors = {};
    this.errorMessage = "";

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = {
      email: this.form.value.email ?? "",
      password: this.form.value.password ?? "",
    };

    this.submitting = true;
    this.auth.login(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(["/"]);
      },
      error: (err) => {
        this.submitting = false;
        if (err.status === 400 && err.error?.errors) {
          this.serverErrors = err.error.errors;
        } else if (err.status === 401) {
          this.errorMessage = "Invalid credentials";
        } else {
          this.errorMessage = "Something went wrong. Please try again.";
        }
      },
    });
  }

  switchToSignup(): void {
    this.switchMode.emit();
  }
}
