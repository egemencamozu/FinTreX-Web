import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConsultancyTaskRepository } from '../../../../../core/interfaces/consultancy-task.repository';
import { ConsultancyTask } from '../../../../../core/models/task.model';
import { ConsultancyTaskStatus } from '../../../../../core/enums/consultancy-task-status.enum';
import { TaskPriority } from '../../../../../core/enums/task-priority.enum';

@Component({
  selector: 'app-assigned-tasks',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assigned-tasks.html',
  styleUrl: './assigned-tasks.scss'
})
export class AssignedTasks implements OnInit {
  tasks = signal<ConsultancyTask[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  selectedTask = signal<ConsultancyTask | null>(null);
  filterStatus = signal<string>('all');
  isGeneratingAnalysis = signal(false);

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

  constructor(private taskRepository: ConsultancyTaskRepository) {}

  ngOnInit() {
    this.loadTasks();
  }

  loadTasks() {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.taskRepository.getMyTasks().subscribe({
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

  selectTask(task: ConsultancyTask) {
    this.selectedTask.set(task);
  }

  deselectTask() {
    this.selectedTask.set(null);
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
      default: return '';
    }
  }

  getStatusDisplay(status: ConsultancyTaskStatus): string {
    switch (status) {
      case ConsultancyTaskStatus.Pending: return 'Beklemede';
      case ConsultancyTaskStatus.InProgress: return 'Devam Ediyor';
      case ConsultancyTaskStatus.Completed: return 'Tamamlandı';
      default: return status;
    }
  }

  getPriorityDisplay(priority: TaskPriority): string {
    switch (priority) {
      case TaskPriority.High: return 'Yüksek';
      case TaskPriority.Medium: return 'Orta';
      case TaskPriority.Low: return 'Düşük';
      default: return priority;
    }
  }
}
