export interface Task {
  id: string;
  userId: string;
  economistId: string;
  description: string;
  status: 'pending' | 'completed';
  createdAt: Date;
}
