import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ConsultancyTaskRepository,
  CreateConsultancyTaskRequest,
} from '../../core/interfaces/consultancy-task.repository';
import { ConsultancyTask } from '../../core/models/task.model';
import { EnvironmentConfigService } from '../../core/services/environment-config.service';

@Injectable({
  providedIn: 'root'
})
export class ConsultancyTaskApiRepository extends ConsultancyTaskRepository {
  private readonly baseUrl: string;

  constructor(
    private http: HttpClient,
    private configService: EnvironmentConfigService
  ) {
    super();
    this.baseUrl = `${this.configService.get('apiBaseUrl')}/v1/ConsultancyTasks`;
  }

  getMyTasks(): Observable<ConsultancyTask[]> {
    return this.http.get<ConsultancyTask[]>(this.baseUrl);
  }

  getTaskById(taskId: number): Observable<ConsultancyTask> {
    return this.http.get<ConsultancyTask>(`${this.baseUrl}/${taskId}`);
  }

  createTask(request: CreateConsultancyTaskRequest): Observable<ConsultancyTask> {
    return this.http.post<ConsultancyTask>(this.baseUrl, request);
  }

  updateTaskStatus(taskId: number, request: { status: string }): Observable<void> {
    // Controller uses PATCH for status updates
    return this.http.patch<void>(`${this.baseUrl}/${taskId}/status`, request);
  }

  generateAnalysis(taskId: number): Observable<ConsultancyTask> {
    return this.http.post<ConsultancyTask>(`${this.baseUrl}/${taskId}/generate-analysis`, {});
  }
}
