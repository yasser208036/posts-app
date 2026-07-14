import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

@Injectable({ providedIn: "root" })
export class CreatePostTriggerService {
  readonly trigger$ = new Subject<void>();
  open(): void {
    this.trigger$.next();
  }
}
