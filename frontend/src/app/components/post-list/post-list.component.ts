import {
  Component,
  OnDestroy,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { PostService } from "../../services/post.service";
import { AuthService } from "../../services/auth.service";
import { Comment, FeedPost } from "../../models/post.model";
import { ModalComponent } from "../modal/modal.component";
import { PostFormComponent } from "../post-form/post-form.component";
import { CreatePostTriggerService } from "../../services/create-post-trigger.service";
import { NotificationNavService } from "../../services/notification-nav.service";
import { FriendEventsService } from "../../services/friend-events.service";
import { Subscription, Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-post-list",
  standalone: true,
  imports: [CommonModule, ModalComponent, PostFormComponent, FormsModule],
  templateUrl: "./post-list.component.html",
})
export class PostListComponent implements OnInit, AfterViewInit, OnDestroy {
  posts: FeedPost[] = [];
  loading = false;
  errorMessage = "";
  showCreateModal = false;
  showEditModal = false;
  editingPostId: string | null = null;

  // Confirmation modal state — replaces the native window.confirm() prompts so
  // destructive actions match the app's visual language.
  confirmState: {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null = null;
  confirmBusy = false;
  currentPage = 1;
  totalPages = 1;
  totalPosts = 0;
  pageSize = 10;
  loadingMore = false;
  private observer?: IntersectionObserver;

  @ViewChild("scrollSentinel") private sentinel!: ElementRef;

  searchTerm = "";
  startDate = "";
  endDate = "";
  currentUserId: string | null = null;

  // Comment state is keyed by post id so each card manages its own thread
  // independently (lazy-loaded on expand).
  expanded = new Set<string>();
  comments: Record<string, Comment[]> = {};
  commentDrafts: Record<string, string> = {};
  commentErrors: Record<string, string> = {};
  private commentsLoaded = new Set<string>();
  private submitting = new Set<string>();

  // Reply / edit UI state, keyed by comment id.
  replyingTo = new Set<string>();
  replyDrafts: Record<string, string> = {};
  editingComment = new Set<string>();
  editDrafts: Record<string, string> = {};
  commentActionError: Record<string, string> = {};
  highlightedCommentId: string | null = null;

  private search$ = new Subject<void>();
  private sub?: Subscription;
  private pendingScroll: { postId: string; commentId: string } | null = null;

  constructor(
    private postService: PostService,
    private createTrigger: CreatePostTriggerService,
    private auth: AuthService,
    private nav: NotificationNavService,
    private friendEvents: FriendEventsService,
  ) {}

  ngOnInit(): void {
    this.sub = new Subscription();
    this.fetchPosts();
    this.sub.add(
      this.auth.user$.subscribe((u) => (this.currentUserId = u?.id ?? null)),
    );
    this.sub.add(
      this.createTrigger.trigger$.subscribe(() => this.openCreateModal()),
    );
    this.sub.add(
      this.search$.pipe(debounceTime(500)).subscribe(() => {
        this.currentPage = 1;
        this.fetchPosts();
      }),
    );
    this.sub.add(
      this.nav.navigate$.subscribe((target) =>
        this.openCommentTarget(target.postId, target.commentId),
      ),
    );
    this.sub.add(
      this.friendEvents.accepted$.subscribe(() => {
        this.currentPage = 1;
        this.fetchPosts();
      }),
    );
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) this.loadMore();
      },
      { threshold: 0.1 },
    );
    this.observer.observe(this.sentinel.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.sub?.unsubscribe();
  }

  // True only for the caller's own posts — Edit/Delete are hidden on friends'.
  isOwn(post: FeedPost): boolean {
    return !!this.currentUserId && post.userId === this.currentUserId;
  }

  fetchPosts(reset = true): void {
    if (reset) {
      this.currentPage = 1;
      this.posts = [];
      this.loading = true;
    } else {
      this.loadingMore = true;
    }
    this.errorMessage = "";
    this.postService
      .getAll(this.currentPage, this.pageSize, {
        title: this.searchTerm,
        startDate: this.startDate,
        endDate: this.endDate,
      })
      .subscribe({
        next: (response) => {
          this.posts = reset
            ? response.data
            : [...this.posts, ...response.data];
          this.totalPosts = response.total;
          this.totalPages = response.totalPages;
          this.currentPage = response.page;
          this.loading = false;
          this.loadingMore = false;
        },
        error: (err) => {
          this.errorMessage =
            err.error?.message || "Failed to load posts. Please try again.";
          this.loading = false;
          this.loadingMore = false;
        },
      });
  }

  loadMore(): void {
    if (this.loadingMore || this.loading || !this.hasMore) return;
    this.currentPage++;
    this.fetchPosts(false);
  }

  deletePost(id: string): void {
    this.openConfirm({
      title: "Delete post",
      message:
        "Are you sure you want to delete this post? This action can't be undone.",
      confirmLabel: "Delete",
      onConfirm: () => this.performDeletePost(id),
    });
  }

  private performDeletePost(id: string): void {
    this.confirmBusy = true;
    this.postService.remove(id).subscribe({
      next: () => {
        if (this.posts.length === 1 && this.currentPage > 1) {
          this.currentPage--;
        }
        this.closeConfirm();
        this.fetchPosts();
      },
      error: () => {
        this.closeConfirm();
        this.errorMessage = "Failed to delete post.";
      },
    });
  }

  openCreateModal(): void {
    this.showCreateModal = true;
  }

  onPostCreated(): void {
    this.showCreateModal = false;
    this.currentPage = 1;
    this.fetchPosts();
  }

  onCreateCancelled(): void {
    this.showCreateModal = false;
  }

  openEditModal(postId: string): void {
    this.editingPostId = postId;
    this.showEditModal = true;
  }

  onPostUpdated(): void {
    this.showEditModal = false;
    const postId = this.editingPostId!;
    this.editingPostId = null;
    this.postService.getOne(postId).subscribe({
      next: (updated) => {
        this.posts = this.posts.map((p) =>
          p.id === postId ? { ...p, ...updated } : p,
        );
      },
      error: () => this.fetchPosts(),
    });
  }

  onEditCancelled(): void {
    this.showEditModal = false;
    this.editingPostId = null;
  }

  onSearchChange(): void {
    this.search$.next();
  }

  // Date changes flow through the same debounced pipe as the search term so
  // rapid edits (typing a year digit by digit) don't fire a request per keystroke.
  onDateChange(): void {
    this.search$.next();
  }

  // True when both bounds are set and the range is inverted (start after end).
  get invalidDateRange(): boolean {
    return !!(this.startDate && this.endDate && this.startDate > this.endDate);
  }

  clearFilters(): void {
    this.searchTerm = "";
    this.startDate = "";
    this.endDate = "";
    this.currentPage = 1;
    this.fetchPosts();
  }

  get hasActiveFilters(): boolean {
    return !!(this.searchTerm.trim() || this.startDate || this.endDate);
  }

  get hasMore(): boolean {
    return this.currentPage < this.totalPages;
  }

  toggleComments(postId: string): void {
    if (this.expanded.has(postId)) {
      this.expanded.delete(postId);
      return;
    }
    this.expanded.add(postId);
    if (!this.commentsLoaded.has(postId)) this.reloadComments(postId);
  }

  private reloadComments(postId: string): void {
    this.postService.getComments(postId).subscribe({
      next: (comments) => {
        this.comments[postId] = comments;
        this.commentsLoaded.add(postId);
        if (this.pendingScroll?.postId === postId) {
          const { commentId } = this.pendingScroll;
          this.pendingScroll = null;
          setTimeout(() => this.scrollToComment(commentId), 0);
        }
      },
      error: () => {
        this.commentErrors[postId] = "Couldn't load comments.";
      },
    });
  }

  openCommentTarget(postId: string, commentId: string): void {
    this.searchTerm = "";
    this.startDate = "";
    this.endDate = "";
    this.currentPage = 1;
    this.pendingScroll = { postId, commentId };
    this.loading = true;
    this.errorMessage = "";
    this.postService.getAll(this.currentPage, this.pageSize, {}).subscribe({
      next: (postsPage) => this.openTargetFromPage(postsPage, postId),
      error: () => this.clearPendingScrollWithError(),
    });
  }

  private openTargetFromPage(
    postsPage: {
      data: FeedPost[];
      total: number;
      totalPages: number;
      page: number;
    },
    postId: string,
  ): void {
    this.posts = postsPage.data;
    this.totalPosts = postsPage.total;
    this.totalPages = postsPage.totalPages;
    this.currentPage = postsPage.page;
    if (!this.posts.some((post) => post.id === postId)) {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.postService.getAll(this.currentPage, this.pageSize, {}).subscribe({
          next: (nextPage) => this.openTargetFromPage(nextPage, postId),
          error: () => this.clearPendingScrollWithError(),
        });
        return;
      }
      this.pendingScroll = null;
      this.loading = false;
      return;
    }
    this.loading = false;
    this.expanded.add(postId);
    this.reloadComments(postId);
  }

  private clearPendingScrollWithError(): void {
    this.pendingScroll = null;
    this.errorMessage = "Failed to load posts. Please try again.";
    this.loading = false;
  }

  private scrollToComment(commentId: string): void {
    const commentElement = document.getElementById(`comment-${commentId}`);
    if (!commentElement) return;
    commentElement.scrollIntoView({ behavior: "smooth", block: "center" });
    this.highlightedCommentId = commentId;
    setTimeout(() => {
      if (this.highlightedCommentId === commentId)
        this.highlightedCommentId = null;
    }, 2000);
  }

  // Top-level comments (no parent) — the reply children are rendered under each.
  topLevel(postId: string): Comment[] {
    return (this.comments[postId] ?? []).filter((c) => c.parentId === null);
  }

  repliesFor(postId: string, parentId: string): Comment[] {
    return (this.comments[postId] ?? []).filter((c) => c.parentId === parentId);
  }

  isOwnComment(comment: Comment): boolean {
    return !!this.currentUserId && comment.authorId === this.currentUserId;
  }

  isSubmitting(postId: string): boolean {
    return this.submitting.has(postId);
  }

  submitComment(postId: string): void {
    const body = (this.commentDrafts[postId] ?? "").trim();
    this.commentErrors[postId] = "";
    if (!body) {
      this.commentErrors[postId] = "Comment is required.";
      return;
    }

    this.submitting.add(postId);
    this.postService.addComment(postId, { body }).subscribe({
      next: (comment) => {
        this.submitting.delete(postId);
        // Append: comments render oldest→newest, so the new one goes last.
        this.comments[postId] = [...(this.comments[postId] ?? []), comment];
        this.commentDrafts[postId] = "";
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.delete(postId);
        if (err.status === 400 && err.error?.errors?.body) {
          this.commentErrors[postId] = err.error.errors.body;
        } else if (err.status === 404) {
          this.commentErrors[postId] =
            "This post is no longer available. Refresh the page.";
        } else {
          this.commentErrors[postId] = "Couldn't add your comment.";
        }
      },
    });
  }

  startReply(comment: Comment): void {
    const mention = `@${comment.author.name} `;
    this.commentActionError[comment.id] = "";
    this.replyingTo.add(comment.id);
    this.replyDrafts[comment.id] = mention;
  }

  cancelReply(commentId: string): void {
    this.replyingTo.delete(commentId);
  }

  submitReply(postId: string, parentId: string): void {
    const body = (this.replyDrafts[parentId] ?? "").trim();
    this.commentActionError[parentId] = "";
    if (!body) {
      this.commentActionError[parentId] = "Reply is required.";
      return;
    }
    this.postService.addComment(postId, { body, parentId }).subscribe({
      next: () => {
        this.replyingTo.delete(parentId);
        this.replyDrafts[parentId] = "";
        // Refetch so the reply nests in server (createdAt) order.
        this.reloadComments(postId);
      },
      error: (err: HttpErrorResponse) =>
        (this.commentActionError[parentId] = this.commentActionMessage(
          err,
          "Couldn't add your reply.",
        )),
    });
  }

  startEdit(comment: Comment): void {
    this.commentActionError[comment.id] = "";
    this.editingComment.add(comment.id);
    this.editDrafts[comment.id] = comment.body;
  }

  cancelEdit(commentId: string): void {
    this.editingComment.delete(commentId);
  }

  saveEdit(postId: string, commentId: string): void {
    const body = (this.editDrafts[commentId] ?? "").trim();
    this.commentActionError[commentId] = "";
    if (!body) {
      this.commentActionError[commentId] = "Comment is required.";
      return;
    }
    this.postService.updateComment(postId, commentId, body).subscribe({
      next: (updated) => {
        this.editingComment.delete(commentId);
        this.comments[postId] = (this.comments[postId] ?? []).map((c) =>
          c.id === commentId ? updated : c,
        );
      },
      error: (err: HttpErrorResponse) =>
        (this.commentActionError[commentId] = this.commentActionMessage(
          err,
          "Couldn't save your edit.",
        )),
    });
  }

  deleteComment(postId: string, commentId: string): void {
    this.openConfirm({
      title: "Delete comment",
      message:
        "Are you sure you want to delete this comment? Any replies to it will be removed too.",
      confirmLabel: "Delete",
      onConfirm: () => this.performDeleteComment(postId, commentId),
    });
  }

  private performDeleteComment(postId: string, commentId: string): void {
    this.commentActionError[commentId] = "";
    this.confirmBusy = true;
    this.postService.deleteComment(postId, commentId).subscribe({
      // A parent delete cascades to its replies, so refetch the whole thread.
      next: () => {
        this.closeConfirm();
        this.reloadComments(postId);
      },
      error: () => {
        this.closeConfirm();
        this.commentActionError[commentId] = "Couldn't delete the comment.";
      },
    });
  }

  // ---- Confirmation modal helpers --------------------------------------
  private openConfirm(state: {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }): void {
    this.confirmState = state;
    this.confirmBusy = false;
  }

  confirmAction(): void {
    this.confirmState?.onConfirm();
  }

  closeConfirm(): void {
    if (this.confirmBusy) return;
    this.confirmState = null;
    this.confirmBusy = false;
  }

  // Maps a comment mutation error to a field message: server 400 body error,
  // 404 (comment/post gone), or a generic fallback.
  private commentActionMessage(
    err: HttpErrorResponse,
    fallback: string,
  ): string {
    if (err.status === 400 && err.error?.errors?.body) {
      return err.error.errors.body;
    }
    if (err.status === 404) {
      return "This comment is no longer available. Refresh the page.";
    }
    return fallback;
  }
}
