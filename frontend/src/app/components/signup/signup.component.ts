import { Component, AfterViewInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../../services/auth.service";
import { trimmedMinLength } from "../../utils/validators";
import {
  isGoogleClientIdPlaceholder,
  initializeGoogleSignIn,
} from "../../utils/google-auth";

@Component({
  selector: "app-signup",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./signup.component.html",
})
export class SignupComponent implements AfterViewInit, OnDestroy {
  form = this.fb.group({
    name: ["", [Validators.required, trimmedMinLength(2)]],
    email: ["", [Validators.required, Validators.email]],
    password: ["", [Validators.required, Validators.minLength(8)]],
  });

  submitting = false;
  errorMessage = "";
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

  get name() {
    return this.form.controls.name;
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
      name: this.form.value.name ?? "",
      email: this.form.value.email ?? "",
      password: this.form.value.password ?? "",
    };

    this.submitting = true;
    this.auth.signup(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(["/"]);
      },
      error: (err) => {
        this.submitting = false;

        if (err.status === 400 && err.error?.errors) {
          this.serverErrors = err.error.errors;
          return;
        }

        if (err.status === 409 && err.error?.errors) {
          this.serverErrors = err.error.errors;
          return;
        }

        if (err.status === 409) {
          this.errorMessage = "Email already exists";
          return;
        }

        this.errorMessage = "Something went wrong. Please try again.";
      },
    });
  }

  navigateToLogin(): void {
    this.router.navigate(["/login"]);
  }
}
