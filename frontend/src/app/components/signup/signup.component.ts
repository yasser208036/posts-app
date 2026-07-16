import { Component, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../services/auth.service";
import { environment } from "../../../environments/environment";

function trimmedMinLength(min: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const trimmed = (control.value ?? "").toString().trim();
    if (trimmed.length === 0) return { required: true };
    return trimmed.length < min
      ? { minlength: { requiredLength: min, actualLength: trimmed.length } }
      : null;
  };
}

declare const google: any;

@Component({
  selector: "app-signup",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./signup.component.html",
})
export class SignupComponent implements AfterViewInit {
  form = this.fb.group({
    name: ["", [Validators.required, trimmedMinLength(2)]],
    email: ["", [Validators.required, Validators.email]],
    password: ["", [Validators.required, Validators.minLength(8)]],
  });

  submitting = false;
  errorMessage = "";
  serverErrors: Record<string, string> = {};

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngAfterViewInit(): void {
    if (!google?.accounts?.id) return;

    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: any) => {
        const credential = response?.credential;
        if (!credential) return;
        this.auth.googleLogin(credential).subscribe({
          next: () => this.router.navigate(["/"]),
        });
      },
    });

    google.accounts.id.renderButton(document.getElementById("googleBtn"), {
      theme: "outline",
      size: "large",
    });
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
