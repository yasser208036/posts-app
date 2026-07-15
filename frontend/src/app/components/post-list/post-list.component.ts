import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { PostService } from "../../services/post.service";
import { Post } from "../../models/post.model";
import { ModalComponent } from "../modal/modal.component";
import { PostFormComponent } from "../post-form/post-form.component";
import { CreatePostTriggerService } from "../../services/create-post-trigger.service";
import { Subscription, Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-post-list",
  standalone: true,
  imports: [CommonModule, ModalComponent, PostFormComponent, FormsModule],
  templateUrl: "./post-list.component.html",
})
export class PostListComponent implements OnInit, OnDestroy {
  posts: Post[] = [];
  loading = false;
  errorMessage = "";
  showCreateModal = false;
  showEditModal = false;
  editingPostId: string | null = null;
  currentPage = 1;
  totalPages = 1;
  totalPosts = 0;
  pageSize = 10;
  searchTerm = "";
  startDate = "";
  endDate = "";
  private search$ = new Subject<void>();
  private sub?: Subscription;

  constructor(
    private postService: PostService,
    private createTrigger: CreatePostTriggerService,
  ) {}

  ngOnInit(): void {
    this.sub = new Subscription();
    this.fetchPosts();
    this.sub.add(
      this.createTrigger.trigger$.subscribe(() => this.openCreateModal()),
    );
    this.sub.add(
      this.search$.pipe(debounceTime(500)).subscribe(() => {
        this.currentPage = 1;
        this.fetchPosts();
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  fetchPosts(): void {
    this.loading = true;
    this.errorMessage = "";
    this.postService
      .getAll(this.currentPage, this.pageSize, {
        title: this.searchTerm,
        startDate: this.startDate,
        endDate: this.endDate,
      })
      .subscribe({
        next: (response) => {
          this.posts = response.data;
          this.totalPosts = response.total;
          this.totalPages = response.totalPages;
          this.currentPage = response.page;
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage =
            err.error?.message || "Failed to load posts. Please try again.";
          this.loading = false;
        },
      });
  }

  deletePost(id: string): void {
    if (!confirm("Delete this post?")) return;
    this.postService.remove(id).subscribe({
      next: () => {
        if (this.posts.length === 1 && this.currentPage > 1) {
          this.currentPage--;
        }
        this.fetchPosts();
      },
      error: () => (this.errorMessage = "Failed to delete post."),
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
    this.editingPostId = null;
    this.fetchPosts();
  }

  onEditCancelled(): void {
    this.showEditModal = false;
    this.editingPostId = null;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.fetchPosts();
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  prevPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  onSearchChange(): void {
    this.search$.next();
  }

  onDateChange(): void {
    this.currentPage = 1;
    this.fetchPosts();
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
}
