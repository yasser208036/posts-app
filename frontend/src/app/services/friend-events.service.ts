import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

@Injectable({ providedIn: "root" })
export class FriendEventsService {
  private accepted = new Subject<void>();
  readonly accepted$ = this.accepted.asObservable();

  notifyAccepted(): void {
    this.accepted.next();
  }
}
