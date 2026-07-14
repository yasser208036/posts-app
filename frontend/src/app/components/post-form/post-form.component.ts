import { Component, EventEmitter, Input, OnInit, OnChanges, Output, SimpleChanges } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { PostService } from "../../services/post.service";

// Mirrors the backend (validatePost.ts): length is measured after trimming,
// so whitespace-only input fails client-side just as it does server-side.
function trimmedMinLength(min: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const trimmed = (control.value ?? "").toString().trim();
    // Whitespace-only is treated as empty, matching the backend's `required` rejection.
    if (trimmed.length === 0) return { required: true };
    return trimmed.length < min
      ? { minlength: { requiredLength: min, actualLength: trimmed.length } }
      : null;
  };
}

@Component({
  selector: "app-post-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./post-form.component.html",
})
export class PostFormComponent implements OnInit, OnChanges {
  @Input() embedded = false;
  @Input() editPostId: string | null = null;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
  form = this.fb.group({
    title: ["", [Validators.required, trimmedMinLength(3)]],
    body: ["", [Validators.required, trimmedMinLength(10)]],
  });

  postId: string | null = null;
  loading = false;
  submitting = false;
  errorMessage = "";
  serverErrors: Record<string, string> = {};

  constructor(
    private fb: FormBuilder,
    private postService: PostService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.embedded) {
      if (this.editPostId) {
        this.postId = this.editPostId;
        this.loading = true;
        this.postService.getOne(this.editPostId).subscribe({
          next: (post) => {
            this.form.patchValue({ title: post.title, body: post.body });
            this.loading = false;
          },
          error: () => {
            this.errorMessage = "Failed to load post.";
            this.loading = false;
          },
        });
      }
      return;
    }
    this.postId = this.route.snapshot.paramMap.get("id");
    if (this.postId) {
      this.loading = true;
      this.postService.getOne(this.postId).subscribe({
        next: (post) => {
          this.form.patchValue({ title: post.title, body: post.body });
          this.loading = false;
        },
        error: () => {
          this.errorMessage = "Failed to load post.";
          this.loading = false;
        },
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes["editPostId"] &&
      this.embedded &&
      !changes["editPostId"].firstChange
    ) {
      this.resetForm();
      this.ngOnInit();
    }
  }

  private resetForm(): void {
    this.form.reset();
    this.serverErrors = {};
    this.errorMessage = "";
    this.submitting = false;
  }

  get title() {
    return this.form.controls.title;
  }
  get body() {
    return this.form.controls.body;
  }

  onSubmit(): void {
    this.serverErrors = {};
    this.errorMessage = "";

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = {
      title: this.form.value.title ?? "",
      body: this.form.value.body ?? "",
    };

    this.submitting = true;
    const request$ = this.postId
      ? this.postService.update(this.postId, payload)
      : this.postService.create(payload);

    request$.subscribe({
      next: () => {
        this.submitting = false;
        if (this.embedded) {
          this.resetForm();
          this.postId = null;
          this.saved.emit();
        } else {
          this.router.navigate(["/"]);
        }
      },
      error: (err) => {
        this.submitting = false;
        if (err.status === 400 && err.error?.errors) {
          this.serverErrors = err.error.errors;
        } else {
          this.errorMessage = "Something went wrong. Please try again.";
        }
      },
    });
  }

  onCancel(): void {
    if (this.embedded) {
      this.cancelled.emit();
    } else {
      this.router.navigate(["/"]);
    }
  }
}
