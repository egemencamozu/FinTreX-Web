export interface PreAnalysisReport {
  id: number;
  consultancyTaskId: number;
  summary: string;
  riskLevel: string;
  marketOutlook: string;
  keyFindings?: string;
  rawContent?: string;
  generatedAtUtc: string;
  isSuccessful: boolean;
  errorMessage?: string;
}
