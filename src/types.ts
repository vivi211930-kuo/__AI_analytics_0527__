export interface CsvTemplate {
  name: string;
  description: string;
  content: string;
  icon: string;
}

export type ReportType = "all" | "summary" | "trends" | "kpi" | "action";
export type AnalysisMode = "fast" | "deep";

export interface AnalysisResponse {
  success: boolean;
  report: string;
  error?: string;
  metadata?: {
    timestamp: string;
    csvLength: number;
    linesAnalyzed: number;
  };
}

export interface AnalysisHistoryItem {
  id: string;
  timestamp: string;
  reportType: ReportType;
  analysisMode: AnalysisMode;
  csvLength: number;
  linesCount: number;
  report: string;
  title: string;
  provider?: "gemini" | "nvidia";
}
