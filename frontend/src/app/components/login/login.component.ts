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
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./login.component.html",
})
export class LoginComponent implements AfterViewInit {
  private gisInitDone = false;
  errorMessage = "";
  form = this.fb.group({
    email: ["", [Validators.required, Validators.email]],
    password: ["", [Validators.required]],
  });

  submitting = false;
  serverErrors: Record<string, string> = {};

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
  ) {}

  private isGoogleClientIdPlaceholder(): boolean {
    return (
      !environment.googleClientId ||
      environment.googleClientId.includes("REPLACE_WITH_GOOGLE_CLIENT_ID")
    );
  }

  private loadGoogleIdentityServicesScript(): Promise<void> {
    // If already available, resolve immediately
    if ((window as any).google?.accounts?.id) return Promise.resolve();

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-gis="true"]',
    );
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new Error("Failed to load Google Identity Services script")),
        );
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.gis = "true";
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load Google Identity Services script"));
      document.head.appendChild(script);
    });
  }

  ngAfterViewInit(): void {
    if (this.gisInitDone) return;
    this.gisInitDone = true;

    if (this.isGoogleClientIdPlaceholder()) {
      // Avoid triggering invalid_client repeatedly; show a clear hint
      console.error(
        "Google Identity Services: googleClientId is placeholder. Update frontend/src/environments/environment.ts",
      );
      this.errorMessage =
        "Google 로그인 غير متاح: تم استبدال googleClientId بقيمة placeholder. سجّل دخول Google يتطلب Google OAuth Client ID صحيح.";
      return;
    }

    this.loadGoogleIdentityServicesScript()
      .then(() => {
        if (!google?.accounts?.id) {
          throw new Error("Google Identity Services SDK not available");
        }

        google.accounts.id.initialize({
          client_id: environment.googleClientId,
          callback: (response: any) => {
            const credential = response?.credential;
            if (!credential) return;

            this.auth.googleLogin(credential).subscribe({
              next: () => this.router.navigate(["/"]),
              error: (err) => {
                console.error("googleLogin error:", err);
                this.errorMessage = "Google 로그인 فشل. حاول مرة أخرى.";
              },
            });
          },
        });

        const btnEl = document.getElementById("googleBtn");
        if (!btnEl) return;

        google.accounts.id.renderButton(btnEl, {
          theme: "outline",
          size: "large",
        });
      })
      .catch((err) => {
        console.error(err);
        this.errorMessage =
          "فشل تحميل Google Identity Services. تأكد من اتصال الإنترنت وتهيئة googleClientId.";
      });
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

  navigateToSignup(): void {
    this.router.navigate(["/signup"]);
  }
}
