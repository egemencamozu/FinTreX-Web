import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ConsultancyTaskRepository } from '../../../../../core/interfaces/consultancy-task.repository';
import { EconomistRepository } from '../../../../../core/interfaces/economist.repository';
import { ConsultancyTask } from '../../../../../core/models/task.model';
import { EconomistClient } from '../../../../../core/models/economist.model';
import { TaskCategory } from '../../../../../core/enums/task-category.enum';
import { TaskPriority } from '../../../../../core/enums/task-priority.enum';
import { ConsultancyTaskStatus } from '../../../../../core/enums/consultancy-task-status.enum';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SelectOption {
  value: string;
  label: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tasks.html',
  styleUrl: './tasks.scss',
})
export class Tasks implements OnInit {
  private readonly taskRepo = inject(ConsultancyTaskRepository);
  private readonly economistRepo = inject(EconomistRepository);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  // ── Data ────────────────────────────────────────────────────────────────────
  readonly tasks = signal<ConsultancyTask[]>([]);
  readonly assignedEconomists = signal<EconomistClient[]>([]);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);

  // ── UI State ────────────────────────────────────────────────────────────────
  readonly showForm = signal(false);
  readonly selectedTask = signal<ConsultancyTask | null>(null);
  readonly isCancelling = signal(false);
  readonly isGeneratingAnalysis = signal(false);

  // ── Form ────────────────────────────────────────────────────────────────────
  readonly taskForm: FormGroup = this.fb.group({
    economistId: ['', [Validators.required]],
    category: ['', [Validators.required]],
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    priority: [TaskPriority.Medium, [Validators.required]],
    deadline: [''],
  });

  // ── Dropdown Options ────────────────────────────────────────────────────────
  readonly categoryOptions: SelectOption[] = [
    { value: TaskCategory.PortfolioAnalysis, label: 'Portföy Değerlendirmesi' },
    { value: TaskCategory.StockEvaluation, label: 'Hisse Analizi' },
    { value: TaskCategory.MarketOutlook, label: 'Piyasa Trend Analizi' },
    { value: TaskCategory.RiskAssessment, label: 'Risk Değerlendirmesi' },
    { value: TaskCategory.SectorAnalysis, label: 'Sektör Analizi' },
  ];

  readonly priorityOptions: SelectOption[] = [
    { value: TaskPriority.Low, label: 'Düşük' },
    { value: TaskPriority.Medium, label: 'Orta' },
    { value: TaskPriority.High, label: 'Yüksek' },
    { value: TaskPriority.Urgent, label: 'Acil' },
  ];

  // ── Computed ────────────────────────────────────────────────────────────────
  readonly openTasks = computed(() =>
    this.tasks().filter(
      (t) =>
        t.status === ConsultancyTaskStatus.Pending ||
        t.status === ConsultancyTaskStatus.InProgress,
    ),
  );

  readonly completedTasks = computed(() =>
    this.tasks().filter(
      (t) =>
        t.status === ConsultancyTaskStatus.Completed ||
        t.status === ConsultancyTaskStatus.Cancelled,
    ),
  );

  readonly hasSingleEconomist = computed(() => this.assignedEconomists().length === 1);

  readonly hasMultipleEconomists = computed(() => this.assignedEconomists().length > 1);

  readonly hasNoEconomist = computed(() => this.assignedEconomists().length === 0);

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadTasks();
    this.loadAssignedEconomists();
  }

  // ── Data Loading ────────────────────────────────────────────────────────────
  private loadTasks(): void {
    this.isLoading.set(true);
    this.taskRepo
      .getMyTasks()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tasks) => {
          this.tasks.set(tasks);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  private loadAssignedEconomists(): void {
    this.economistRepo
      .getMyEconomists()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (economists) => {
          this.assignedEconomists.set(economists);
          // Tek ekonomist varsa auto-fill
          if (economists.length === 1) {
            this.taskForm.patchValue({ economistId: economists[0].economistId });
            this.taskForm.get('economistId')?.disable();
          }
        },
        error: (err: any) => console.error('Failed to load assigned economists', err)
      });
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  toggleForm(): void {
    const currentState = this.showForm();
    if (!currentState) {
      this.resetForm();
      this.selectedTask.set(null); // Close detail when opening form
    }
    this.showForm.set(!currentState);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.resetForm();
  }

  selectTask(task: ConsultancyTask): void {
    this.selectedTask.set(task);
    this.showForm.set(false); // Close form when viewing detail
  }

  closeDetail(): void {
    this.selectedTask.set(null);
  }

  cancelTask(task: ConsultancyTask): void {
    if (!this.canCancel(task)) return;

    this.isCancelling.set(true);
    this.taskRepo
      .updateTaskStatus(task.id, { status: ConsultancyTaskStatus.Cancelled })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isCancelling.set(false);
          this.selectedTask.set(null);
          this.loadTasks();
        },
        error: () => {
          this.isCancelling.set(false);
        },
      });
  }

  canCancel(task: ConsultancyTask): boolean {
    return (
      task.status === ConsultancyTaskStatus.Pending ||
      task.status === ConsultancyTaskStatus.InProgress
    );
  }

  submitTask(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    // getRawValue() to include disabled fields (auto-filled economistId)
    const formValue = this.taskForm.getRawValue();

    this.taskRepo
      .createTask({
        economistId: formValue.economistId,
        category: formValue.category,
        title: formValue.title,
        description: formValue.description,
        priority: formValue.priority,
        deadline: formValue.deadline || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.closeForm();
          this.loadTasks();
        },
        error: () => {
          this.isSubmitting.set(false);
        },
      });
  }

  generateAnalysis(task: ConsultancyTask): void {
    this.isGeneratingAnalysis.set(true);
    this.taskRepo
      .generateAnalysis(task.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedTask) => {
          this.isGeneratingAnalysis.set(false);
          // Update the task in the list with the new report data
          this.tasks.update(tasks =>
            tasks.map(t => t.id === updatedTask.id ? { ...t, preAnalysisReport: updatedTask.preAnalysisReport } : t)
          );
          // Update selected task
          const current = this.selectedTask();
          if (current?.id === updatedTask.id) {
            this.selectedTask.set({ ...current, preAnalysisReport: updatedTask.preAnalysisReport });
          }
        },
        error: () => {
          this.isGeneratingAnalysis.set(false);
        },
      });
  }

  private resetForm(): void {
    this.taskForm.reset({
      economistId: this.hasSingleEconomist()
        ? this.assignedEconomists()[0].economistId
        : '',
      category: '',
      title: '',
      description: '',
      priority: TaskPriority.Medium,
      deadline: '',
    });

    if (this.hasSingleEconomist()) {
      this.taskForm.get('economistId')?.disable();
    } else {
      this.taskForm.get('economistId')?.enable();
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  getCategoryLabel(category: TaskCategory | string): string {
    const found = this.categoryOptions.find((o) => o.value === category);
    return found?.label ?? String(category);
  }

  getPriorityLabel(priority: TaskPriority | string): string {
    const found = this.priorityOptions.find((o) => o.value === priority);
    return found?.label ?? String(priority);
  }

  getStatusLabel(status: ConsultancyTaskStatus | string): string {
    const map: Record<string, string> = {
      [ConsultancyTaskStatus.Pending]: 'Bekliyor',
      [ConsultancyTaskStatus.InProgress]: 'İşleniyor',
      [ConsultancyTaskStatus.Completed]: 'Tamamlandı',
      [ConsultancyTaskStatus.Cancelled]: 'İptal Edildi',
    };
    return map[status] ?? String(status);
  }

  getStatusColor(status: ConsultancyTaskStatus | string): string {
    const map: Record<string, string> = {
      [ConsultancyTaskStatus.Pending]: 'warning',
      [ConsultancyTaskStatus.InProgress]: 'info',
      [ConsultancyTaskStatus.Completed]: 'success',
      [ConsultancyTaskStatus.Cancelled]: 'danger',
    };
    return map[status] ?? 'default';
  }

  getPriorityColor(priority: TaskPriority | string): string {
    const map: Record<string, string> = {
      [TaskPriority.Low]: 'info',
      [TaskPriority.Medium]: 'warning',
      [TaskPriority.High]: 'danger',
      [TaskPriority.Urgent]: 'urgent',
    };
    return map[priority] ?? 'default';
  }

  formatDate(iso: string): string {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
  }

  formatDateTime(iso: string): string {
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  }

  formatDeadline(iso: string | undefined): string {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `${Math.abs(diffDays)} gün geçti`;
    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Yarın';
    return `${diffDays} gün kaldı`;
  }

  isDeadlineExpired(iso: string | undefined): boolean {
    if (!iso) return false;
    return new Date(iso).getTime() < Date.now();
  }

  getEconomistName(economistId: string): string {
    const found = this.assignedEconomists().find((e) => e.economistId === economistId);
    return found?.economistName ?? 'Bilinmeyen Ekonomist';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.taskForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.taskForm.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';

    if (field.errors['required']) {
      const labels: Record<string, string> = {
        economistId: 'Ekonomist',
        category: 'Kategori',
        title: 'Başlık',
        description: 'Açıklama',
        priority: 'Öncelik',
      };
      return `${labels[fieldName] || fieldName} alanı zorunludur.`;
    }
    if (field.errors['minlength']) {
      const min = field.errors['minlength'].requiredLength;
      return `En az ${min} karakter girilmelidir.`;
    }
    return '';
  }
}
