export interface AttributionSummary {
  totalDiffs: number;
  attributed: number;
  unattributed: number;
  byConfidence: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface RetryGroup {
  id: string;
  failureNodeId: string;
  fixNodeIds: string[];
  successNodeId?: string;
  hotspotFiles: string[];
}

export interface SessionSummary {
  agent: string;
  duration: number;
  totalPrompts: number;
  totalCommands: number;
  totalDiffFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  testsPassed: number;
  testsFailed: number;
  retryCount: number;
  hasBaselineDiff: boolean;
}

export interface AnalysisWarning {
  code: string;
  message: string;
}

export interface SessionAnalysis {
  schemaVersion: string;
  sessionId: string;
  generatedAt: number;
  attribution: AttributionSummary;
  retryGroups: RetryGroup[];
  summary: SessionSummary;
  warnings: AnalysisWarning[];
}
