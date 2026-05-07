export interface EconomistRating {
  taskId: number;
  taskTitle: string;
  userName: string;
  rating: number;
  feedback?: string | null;
  ratedAtUtc: string;
}
