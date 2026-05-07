import { Component, OnInit, signal, computed, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConsultancyTaskRepository } from '../../../../../core/interfaces/consultancy-task.repository';
import { AlertsSignalRService } from '../../../../../core/services/alerts-signalr.service';
import { ConsultancyTask } from '../../../../../core/models/task.model';
import { ConsultancyTaskStatus } from '../../../../../core/enums/consultancy-task-status.enum';
import { TaskPriority } from '../../../../../core/enums/task-priority.enum';
import { KpiCardComponent } from '../../../../shared/components/kpi-card/kpi-card.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../../../shared/components/segmented-control/segmented-control.component';

@Component({
  selector: 'app-assigned-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, KpiCardComponent, SegmentedControlComponent],
  templateUrl: './assigned-tasks.html',
  styleUrl: './assigned-tasks.scss'
})
export class AssignedTasks implements OnInit {
  private readonly alertsSignalR = inject(AlertsSignalRService);
  private readonly destroyRef = inject(DestroyRef);

  tasks = signal<ConsultancyTask[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  selectedTask = signal<ConsultancyTask | null>(null);
  filterStatus = signal<string>('all');
  isGeneratingAnalysis = signal(false);
  isSubmittingReport = signal(false);
  reportText = signal('');

  filteredTasks = computed(() => {
    const status = this.filterStatus();
    const allTasks = this.tasks();

    if (status === 'all') return allTasks;
    return allTasks.filter(t => t.status === status);
  });

  taskStats = computed(() => {
    const allTasks = this.tasks();
    return {
      total: allTasks.length,
      pending: allTasks.filter(t => t.status === ConsultancyTaskStatus.Pending).length,
      inProgress: allTasks.filter(t => t.status === ConsultancyTaskStatus.InProgress).length,
      completed: allTasks.filter(t => t.status === ConsultancyTaskStatus.Completed).length,
    };
  });

  ConsultancyTaskStatus = ConsultancyTaskStatus;
  TaskPriority = TaskPriority;

  readonly statusFilterOptions: SegmentedOption[] = [
    { id: 'all', label: 'Tümü' },
    { id: ConsultancyTaskStatus.Pending, label: 'Beklemede' },
    { id: ConsultancyTaskStatus.InProgress, label: 'Devam Ediyor' },
    { id: ConsultancyTaskStatus.Completed, label: 'Tamamlandı' },
  ];

  constructor(private taskRepository: ConsultancyTaskRepository) {}

  ngOnInit() {
    this.loadTasks();
    this.bindRealtimeTaskUpdates();
  }

  loadTasks(showLoading = true) {
    if (showLoading) {
      this.isLoading.set(true);
    }
    this.errorMessage.set(null);

    this.taskRepository.getMyTasks().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.tasks.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load tasks:', err);
        this.errorMessage.set('Görevler yüklenemedi. Lütfen daha sonra tekrar deneyin.');
        this.isLoading.set(false);
      }
    });
  }

  private bindRealtimeTaskUpdates(): void {
    void this.alertsSignalR.connect();

    this.alertsSignalR.taskCreated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadTasks(false));

    this.alertsSignalR.taskStatusChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.refreshTask(event.taskId));

    this.alertsSignalR.taskCompleted$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.refreshTask(event.taskId));

    this.alertsSignalR.taskRated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.refreshTask(event.taskId));
  }

  private refreshTask(taskId: number): void {
    this.taskRepository.getTaskById(taskId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (task) => this.upsertTask(task),
      error: () => this.loadTasks(false),
    });
  }

  private upsertTask(updatedTask: ConsultancyTask): void {
    this.tasks.update((tasks) => {
      const existing = tasks.find((task) => task.id === updatedTask.id);
      const merged = existing ? { ...existing, ...updatedTask } : updatedTask;
      const next = existing
        ? tasks.map((task) => (task.id === updatedTask.id ? merged : task))
        : [merged, ...tasks];

      return next.sort(
        (a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime(),
      );
    });

    const current = this.selectedTask();
    if (current?.id === updatedTask.id) {
      this.selectedTask.set({ ...current, ...updatedTask });
    }
  }

  selectTask(task: ConsultancyTask) {
    this.selectedTask.set(task);
    this.reportText.set('');
  }

  deselectTask() {
    this.selectedTask.set(null);
  }

  setFilterStatus(value: string): void {
    this.filterStatus.set(value);
  }

  updateTaskStatus(taskId: number, newStatus: ConsultancyTaskStatus) {
    this.taskRepository.updateTaskStatus(taskId, { status: newStatus }).subscribe({
      next: () => {
        this.tasks.update(tasks =>
          tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
        );
        this.deselectTask();
      },
      error: (err) => {
        console.error('Failed to update task status:', err);
        this.errorMessage.set('Görev durumu güncellenemedi.');
      }
    });
  }

  submitReport(taskId: number): void {
    const report = this.reportText().trim();
    if (!report) return;
    this.isSubmittingReport.set(true);
    this.taskRepository.submitReport(taskId, report).subscribe({
      next: (updatedTask) => {
        this.isSubmittingReport.set(false);
        this.tasks.update(tasks =>
          tasks.map(t => t.id === taskId ? updatedTask : t)
        );
        this.selectedTask.set(updatedTask);
        this.reportText.set('');
      },
      error: () => {
        this.isSubmittingReport.set(false);
        this.errorMessage.set('Rapor gönderilemedi.');
      }
    });
  }

  generateAnalysis(taskId: number): void {
    this.isGeneratingAnalysis.set(true);
    this.taskRepository.generateAnalysis(taskId).subscribe({
      next: (updatedTask) => {
        this.isGeneratingAnalysis.set(false);
        this.tasks.update(tasks =>
          tasks.map(t => t.id === updatedTask.id ? { ...t, preAnalysisReport: updatedTask.preAnalysisReport } : t)
        );
        const current = this.selectedTask();
        if (current?.id === updatedTask.id) {
          this.selectedTask.set({ ...current, preAnalysisReport: updatedTask.preAnalysisReport });
        }
      },
      error: (err) => {
        this.isGeneratingAnalysis.set(false);
        console.error('Failed to generate analysis:', err);
        this.errorMessage.set('Analiz oluşturulamadı. Python PAA servisinin çalıştığından emin olun.');
      }
    });
  }

  getPriorityClass(priority: TaskPriority): string {
    switch (priority) {
      case TaskPriority.Urgent: return 'task-priority-urgent';
      case TaskPriority.High: return 'task-priority-high';
      case TaskPriority.Medium: return 'task-priority-medium';
      case TaskPriority.Low: return 'task-priority-low';
      default: return '';
    }
  }

  getStatusClass(status: ConsultancyTaskStatus): string {
    switch (status) {
      case ConsultancyTaskStatus.Pending: return 'task-status-pending';
      case ConsultancyTaskStatus.InProgress: return 'task-status-in-progress';
      case ConsultancyTaskStatus.Completed: return 'task-status-completed';
      case ConsultancyTaskStatus.Cancelled: return 'task-status-cancelled';
      default: return '';
    }
  }

  getStatusDisplay(status: ConsultancyTaskStatus): string {
    switch (status) {
      case ConsultancyTaskStatus.Pending: return 'Beklemede';
      case ConsultancyTaskStatus.InProgress: return 'Devam Ediyor';
      case ConsultancyTaskStatus.Completed: return 'Tamamlandı';
      case ConsultancyTaskStatus.Cancelled: return 'İptal Edildi';
      default: return status;
    }
  }

  getPriorityDisplay(priority: TaskPriority): string {
    switch (priority) {
      case TaskPriority.Urgent: return 'Acil';
      case TaskPriority.High: return 'Yüksek';
      case TaskPriority.Medium: return 'Orta';
      case TaskPriority.Low: return 'Düşük';
      default: return priority;
    }
  }

  getCategoryDisplay(category: string): string {
    const labels: Record<string, string> = {
      General: 'Genel Danışmanlık',
      PortfolioAnalysis: 'Portföy Analizi',
      StockEvaluation: 'Hisse Değerlendirme',
      MarketOutlook: 'Piyasa Görünümü',
      RiskAssessment: 'Risk Analizi',
      SectorAnalysis: 'Sektör Analizi',
    };

    return labels[category] ?? category;
  }
}
