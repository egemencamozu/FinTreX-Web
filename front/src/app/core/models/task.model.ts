import { TaskCategory } from '../enums/task-category.enum';
import { TaskPriority } from '../enums/task-priority.enum';
import { ConsultancyTaskStatus } from '../enums/consultancy-task-status.enum';
import { PreAnalysisReport } from './pre-analysis-report.model';

export interface ConsultancyTask {
  id: number;
  userId: string;
  userName: string;
  economistId: string;
  economistName: string;
  category: TaskCategory;
  title: string;
  description: string;
  priority: TaskPriority;
  deadline?: string;
  status: ConsultancyTaskStatus;
  createdAtUtc: string;
  completedAtUtc?: string;
  preAnalysisReport?: PreAnalysisReport;
}
