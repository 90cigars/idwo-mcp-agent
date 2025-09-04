export interface Config {
  openai: {
    apiKey: string;
    model: string;
  };
  github: {
    token: string;
    organization?: string;
  };
  jira: {
    url: string;
    username: string;
    apiToken: string;
  };
  slack: {
    botToken: string;
    appToken: string;
    signingSecret: string;
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  server: {
    port: number;
    nodeEnv: string;
    logLevel: string;
  };
  security: {
    jwtSecret: string;
    encryptionKey: string;
  };
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
  circuitBreaker: {
    timeout: number;
    threshold: number;
    resetTimeout: number;
  };
}

export interface PRAnalysisResult {
  summary: string;
  suggestedReviewers: string[];
  riskLevel: 'low' | 'medium' | 'high';
  estimatedReviewTime: number;
  topics: string[];
  relatedJiraTickets?: string[];
}

export interface IssueTriageResult {
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  estimatedEffort: number;
  suggestedAssignee?: string;
  suggestedSprint?: string;
  dependencies: string[];
  tags: string[];
}

export interface WorkflowStatus {
  id: string;
  type: 'pr' | 'issue' | 'release';
  status: string;
  lastUpdated: Date;
  services: {
    github?: { status: string; url: string };
    jira?: { status: string; key: string };
    slack?: { channel: string; messageId: string };
  };
}

export interface ReleaseAnalysis {
  readiness: number; // 0-100 score
  blockers: Array<{ type: string; description: string; severity: 'low' | 'medium' | 'high' }>;
  testCoverage: number;
  openIssues: number;
  recommendation: 'proceed' | 'caution' | 'block';
  suggestedActions: string[];
}

export interface TeamInsights {
  velocity: {
    current: number;
    historical: number[];
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  bottlenecks: Array<{
    type: 'review' | 'testing' | 'deployment' | 'planning';
    description: string;
    impact: number;
  }>;
  teamMetrics: {
    avgPRSize: number;
    avgReviewTime: number;
    deploymentFrequency: number;
    cycleTime: number;
  };
}

export class ServiceError extends Error {
  public service: 'github' | 'jira' | 'slack' | 'openai';
  public statusCode?: number;
  public retryable: boolean;

  constructor(
    message: string,
    options: {
      service: 'github' | 'jira' | 'slack' | 'openai';
      statusCode?: number;
      retryable: boolean;
    }
  ) {
    super(message);
    this.name = 'ServiceError';
    this.service = options.service;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable;
  }
}