import { AbstractControl, ValidationErrors, Validators } from "@angular/forms";

/**
 * Validator that checks trimmed length after removing whitespace.
 * Mirrors backend validation (validatePost.ts, validateAuth.ts).
 * Whitespace-only input is treated as empty and fails required.
 */
export function trimmedMinLength(min: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const trimmed = (control.value ?? "").toString().trim();
    if (trimmed.length === 0) return { required: true };
    return trimmed.length < min
      ? { minlength: { requiredLength: min, actualLength: trimmed.length } }
      : null;
  };
}
