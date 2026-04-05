import { Observable } from 'rxjs';
import { ConsultancyTask } from '../models/task.model';

export abstract class ConsultancyTaskRepository {
  abstract getMyTasks(): Observable<ConsultancyTask[]>;
  abstract getTaskById(taskId: number): Observable<ConsultancyTask>;
  abstract createTask(request: CreateConsultancyTaskRequest): Observable<ConsultancyTask>;
  abstract updateTaskStatus(taskId: number, request: { status: string }): Observable<void>;
  abstract generateAnalysis(taskId: number): Observable<ConsultancyTask>;
}

export interface CreateConsultancyTaskRequest {
  economistId: string;
  category: string;
  title: string;
  description: string;
  priority: string;
  deadline?: string;
}
