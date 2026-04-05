export interface EconomistClient {
  id: number;
  economistId: string;
  clientId: string;
  economistName?: string;
  clientName?: string;
  assignedAtUtc: string;
  isActive: boolean;
  notes?: string;
}
