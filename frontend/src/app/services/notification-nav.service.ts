import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

export interface CommentTarget {
  postId: string;
  commentId: string;
}

@Injectable({ providedIn: "root" })
export class NotificationNavService {
  private target$ = new Subject<CommentTarget>();
  readonly navigate$ = this.target$.asObservable();

  navigateToComment(target: CommentTarget): void {
    this.target$.next(target);
  }
}
