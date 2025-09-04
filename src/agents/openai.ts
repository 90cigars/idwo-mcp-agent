import OpenAI from 'openai';
import logger from '../utils/logger.js';
import { ServiceError } from '../types/index.js';

export interface OpenAIConfig {
  apiKey: string;
  model: string;
}

export interface AnalysisPrompt {
  type: 'pr_analysis' | 'issue_triage' | 'release_readiness' | 'team_insights';
  context: Record<string, any>;
  instructions: string;
}

export interface AnalysisResult {
  analysis: string;
  confidence: number;
  recommendations: string[];
  structuredData?: Record<string, any>;
}

export class OpenAIAgent {
  private client: OpenAI;
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  async analyzeContext(prompt: AnalysisPrompt): Promise<AnalysisResult> {
    try {
      const systemPrompt = this.getSystemPrompt(prompt.type);
      const userPrompt = this.buildUserPrompt(prompt);

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      const parsedResult = JSON.parse(content) as {
        analysis: string;
        confidence: number;
        recommendations: string[];
        structured_data?: Record<string, any>;
      };

      logger.info('OpenAI analysis completed', {
        type: prompt.type,
        confidence: parsedResult.confidence,
        recommendationsCount: parsedResult.recommendations.length,
        usage: response.usage,
      });

      return {
        analysis: parsedResult.analysis,
        confidence: Math.max(0, Math.min(100, parsedResult.confidence)),
        recommendations: parsedResult.recommendations,
        structuredData: parsedResult.structured_data,
      };
    } catch (error) {
      logger.error('OpenAI analysis failed', { prompt: prompt.type, error });
      throw new ServiceError(`OpenAI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'openai',
        retryable: error instanceof Error && error.message.includes('rate limit'),
      });
    }
  }

  async analyzePullRequest(prData: {
    title: string;
    description: string;
    files: Array<{ filename: string; additions: number; deletions: number; patch?: string }>;
    commits: Array<{ message: string; author: string }>;
    reviews?: Array<{ user: string; state: string }>;
    teamMembers?: string[];
    codeOwners?: Record<string, string[]>;
  }): Promise<AnalysisResult> {
    const prompt: AnalysisPrompt = {
      type: 'pr_analysis',
      context: prData,
      instructions: `Analyze this pull request and provide:
        1. A comprehensive summary of the changes
        2. Risk assessment (low/medium/high)
        3. Suggested reviewers based on file changes and team expertise
        4. Estimated review time in hours
        5. Key areas that need attention during review
        6. Potential impact on other systems or features`,
    };

    const result = await this.analyzeContext(prompt);

    const structuredData = {
      riskLevel: this.extractRiskLevel(result.analysis),
      estimatedReviewTime: this.extractReviewTime(result.analysis),
      suggestedReviewers: this.extractReviewers(result.analysis, prData.teamMembers),
      topics: this.extractTopics(result.analysis),
      impactAreas: this.extractImpactAreas(prData.files),
    };

    return { ...result, structuredData };
  }

  async triageIssue(issueData: {
    title: string;
    description: string;
    labels: string[];
    comments: Array<{ author: string; body: string }>;
    reporter: string;
    component?: string;
    teamContext?: string;
    similarIssues?: Array<{ key: string; summary: string; resolution?: string }>;
  }): Promise<AnalysisResult> {
    const prompt: AnalysisPrompt = {
      type: 'issue_triage',
      context: issueData,
      instructions: `Analyze this issue and provide:
        1. Priority level (Low/Medium/High/Critical) with justification
        2. Suggested category/component classification
        3. Estimated effort in story points (1, 2, 3, 5, 8, 13)
        4. Recommended assignee based on expertise area
        5. Suggested sprint assignment
        6. Dependencies or blocking issues to consider
        7. Tags for better organization`,
    };

    const result = await this.analyzeContext(prompt);

    const structuredData = {
      priority: this.extractPriority(result.analysis),
      category: this.extractCategory(result.analysis),
      estimatedEffort: this.extractEffort(result.analysis),
      suggestedAssignee: this.extractAssignee(result.analysis),
      dependencies: this.extractDependencies(result.analysis),
      tags: this.extractTags(result.analysis),
    };

    return { ...result, structuredData };
  }

  async assessReleaseReadiness(releaseData: {
    version: string;
    commits: Array<{ message: string; author: string }>;
    openIssues: Array<{ key: string; priority: string; summary: string }>;
    testResults?: { passed: number; failed: number; coverage: number };
    deploymentHistory: Array<{ version: string; success: boolean; date: string }>;
    teamVelocity: { current: number; historical: number[] };
  }): Promise<AnalysisResult> {
    const prompt: AnalysisPrompt = {
      type: 'release_readiness',
      context: releaseData,
      instructions: `Assess this release readiness and provide:
        1. Overall readiness score (0-100)
        2. Critical blockers that must be addressed
        3. Risk assessment for deployment
        4. Recommended actions before release
        5. Rollback strategy considerations
        6. Post-release monitoring recommendations`,
    };

    const result = await this.analyzeContext(prompt);

    const structuredData = {
      readinessScore: this.extractReadinessScore(result.analysis),
      blockers: this.extractBlockers(result.analysis),
      riskLevel: this.extractRiskLevel(result.analysis),
      recommendedActions: this.extractActions(result.analysis),
    };

    return { ...result, structuredData };
  }

  async generateTeamInsights(teamData: {
    name: string;
    members: string[];
    velocity: { current: number; historical: number[] };
    pullRequests: Array<{ author: string; reviewTime: number; size: number }>;
    issues: Array<{ assignee: string; timeToResolve: number; priority: string }>;
    deployments: Array<{ success: boolean; date: string; leadTime: number }>;
    period: string;
  }): Promise<AnalysisResult> {
    const prompt: AnalysisPrompt = {
      type: 'team_insights',
      context: teamData,
      instructions: `Analyze team performance and provide:
        1. Key productivity metrics and trends
        2. Identified bottlenecks in the development process
        3. Team collaboration effectiveness
        4. Recommended process improvements
        5. Individual contributor insights (anonymized)
        6. Predictive insights for future sprints`,
    };

    const result = await this.analyzeContext(prompt);

    const structuredData = {
      velocityTrend: this.calculateVelocityTrend(teamData.velocity),
      bottlenecks: this.extractBottlenecks(result.analysis),
      teamMetrics: this.calculateTeamMetrics(teamData),
      predictions: this.extractPredictions(result.analysis),
    };

    return { ...result, structuredData };
  }

  private getSystemPrompt(type: AnalysisPrompt['type']): string {
    const basePrompt = `You are an expert software engineering advisor with deep knowledge of development workflows, code review practices, project management, and team dynamics. You provide actionable, data-driven insights while maintaining a focus on practical implementation.

Always respond with valid JSON in this format:
{
  "analysis": "Detailed analysis text",
  "confidence": number (0-100),
  "recommendations": ["action 1", "action 2", ...],
  "structured_data": { ... additional structured information ... }
}`;

    const specificPrompts = {
      pr_analysis: `${basePrompt}

For pull request analysis, focus on:
- Code quality and maintainability impact
- Security considerations
- Performance implications
- Testing coverage needs
- Integration risks
- Reviewer expertise matching`,

      issue_triage: `${basePrompt}

For issue triage, focus on:
- Business impact assessment
- Technical complexity evaluation
- Resource allocation optimization
- Dependencies and blockers
- Sprint planning considerations
- Component ownership clarity`,

      release_readiness: `${basePrompt}

For release readiness assessment, focus on:
- Risk mitigation strategies
- Quality assurance validation
- Operational readiness
- Rollback preparedness
- Stakeholder communication
- Success metrics definition`,

      team_insights: `${basePrompt}

For team insights, focus on:
- Process efficiency analysis
- Collaboration pattern identification
- Skill gap assessment
- Workload distribution evaluation
- Continuous improvement opportunities
- Predictive trend analysis`,
    };

    return specificPrompts[type];
  }

  private buildUserPrompt(prompt: AnalysisPrompt): string {
    const contextJson = JSON.stringify(prompt.context, null, 2);
    return `${prompt.instructions}

Context data:
${contextJson}

Please provide your analysis in the specified JSON format.`;
  }

  private extractRiskLevel(analysis: string): 'low' | 'medium' | 'high' {
    const lowerAnalysis = analysis.toLowerCase();
    if (lowerAnalysis.includes('high risk') || lowerAnalysis.includes('critical')) {
      return 'high';
    }
    if (lowerAnalysis.includes('medium risk') || lowerAnalysis.includes('moderate')) {
      return 'medium';
    }
    return 'low';
  }

  private extractReviewTime(analysis: string): number {
    const timeMatch = analysis.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
    return timeMatch && timeMatch[1] ? parseFloat(timeMatch[1]) : 2;
  }

  private extractReviewers(analysis: string, teamMembers?: string[]): string[] {
    if (!teamMembers) return [];
    
    const mentioned = teamMembers.filter(member => 
      analysis.toLowerCase().includes(member.toLowerCase())
    );
    
    return mentioned.length > 0 ? mentioned.slice(0, 3) : teamMembers.slice(0, 2);
  }

  private extractTopics(analysis: string): string[] {
    const topics = [];
    if (analysis.toLowerCase().includes('database')) topics.push('database');
    if (analysis.toLowerCase().includes('api')) topics.push('api');
    if (analysis.toLowerCase().includes('ui') || analysis.toLowerCase().includes('frontend')) topics.push('frontend');
    if (analysis.toLowerCase().includes('backend')) topics.push('backend');
    if (analysis.toLowerCase().includes('security')) topics.push('security');
    if (analysis.toLowerCase().includes('performance')) topics.push('performance');
    return topics;
  }

  private extractImpactAreas(files: Array<{ filename: string }>): string[] {
    const areas = new Set<string>();
    
    files.forEach(file => {
      const path = file.filename.toLowerCase();
      if (path.includes('test')) areas.add('testing');
      if (path.includes('config') || path.includes('env')) areas.add('configuration');
      if (path.includes('db') || path.includes('migration')) areas.add('database');
      if (path.includes('auth')) areas.add('authentication');
      if (path.includes('api') || path.includes('controller')) areas.add('api');
      if (path.includes('ui') || path.includes('component')) areas.add('frontend');
    });

    return Array.from(areas);
  }

  private extractPriority(analysis: string): 'low' | 'medium' | 'high' | 'critical' {
    const lowerAnalysis = analysis.toLowerCase();
    if (lowerAnalysis.includes('critical')) return 'critical';
    if (lowerAnalysis.includes('high priority')) return 'high';
    if (lowerAnalysis.includes('medium priority')) return 'medium';
    return 'low';
  }

  private extractCategory(analysis: string): string {
    const lowerAnalysis = analysis.toLowerCase();
    if (lowerAnalysis.includes('bug') || lowerAnalysis.includes('defect')) return 'bug';
    if (lowerAnalysis.includes('feature') || lowerAnalysis.includes('enhancement')) return 'feature';
    if (lowerAnalysis.includes('task') || lowerAnalysis.includes('improvement')) return 'task';
    return 'story';
  }

  private extractEffort(analysis: string): number {
    const effortMatch = analysis.match(/(\d+)\s*(?:story\s*points?|points?|sp)/i);
    return effortMatch && effortMatch[1] ? parseInt(effortMatch[1]) : 3;
  }

  private extractAssignee(analysis: string): string | undefined {
    const assigneeMatch = analysis.match(/assign(?:ed?)?\s+to\s+(\w+)/i);
    return assigneeMatch ? assigneeMatch[1] : undefined;
  }

  private extractDependencies(analysis: string): string[] {
    const deps: string[] = [];
    const depPattern = /(depends?\s+on|blocked?\s+by|requires?)\s+([A-Z]+-\d+|#\d+|\w+-\w+)/gi;
    let match;
    
    while ((match = depPattern.exec(analysis)) !== null) {
      if (match[2]) {
        deps.push(match[2]);
      }
    }
    
    return deps;
  }

  private extractTags(analysis: string): string[] {
    const tags = [];
    if (analysis.toLowerCase().includes('urgent')) tags.push('urgent');
    if (analysis.toLowerCase().includes('security')) tags.push('security');
    if (analysis.toLowerCase().includes('performance')) tags.push('performance');
    if (analysis.toLowerCase().includes('ui')) tags.push('ui');
    if (analysis.toLowerCase().includes('api')) tags.push('api');
    return tags;
  }

  private extractReadinessScore(analysis: string): number {
    const scoreMatch = analysis.match(/(?:readiness|score)\s*:?\s*(\d+)(?:%|\/100)?/i);
    return scoreMatch && scoreMatch[1] ? parseInt(scoreMatch[1]) : 70;
  }

  private extractBlockers(analysis: string): Array<{ type: string; description: string; severity: string }> {
    const blockers = [];
    const blockerPattern = /blocker|critical|must\s+(?:fix|address|resolve)/gi;
    
    if (blockerPattern.test(analysis)) {
      blockers.push({
        type: 'quality',
        description: 'Quality gates not met',
        severity: 'high',
      });
    }
    
    return blockers;
  }

  private extractActions(analysis: string): string[] {
    const actions: string[] = [];
    const sentences = analysis.split(/[.!?]+/);
    
    sentences.forEach(sentence => {
      if (sentence.toLowerCase().includes('should') || 
          sentence.toLowerCase().includes('must') || 
          sentence.toLowerCase().includes('recommend')) {
        actions.push(sentence.trim());
      }
    });
    
    return actions.slice(0, 5);
  }

  private calculateVelocityTrend(velocity: { current: number; historical: number[] }): string {
    if (velocity.historical.length < 2) return 'stable';
    
    const recent = velocity.historical.slice(-3);
    const earlier = velocity.historical.slice(0, -3);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
    
    if (recentAvg > earlierAvg * 1.1) return 'increasing';
    if (recentAvg < earlierAvg * 0.9) return 'decreasing';
    return 'stable';
  }

  private extractBottlenecks(analysis: string): Array<{ type: string; description: string; impact: number }> {
    const bottlenecks = [];
    
    if (analysis.toLowerCase().includes('review')) {
      bottlenecks.push({
        type: 'review',
        description: 'Code review process delays',
        impact: 3,
      });
    }
    
    if (analysis.toLowerCase().includes('testing')) {
      bottlenecks.push({
        type: 'testing',
        description: 'Testing pipeline bottlenecks',
        impact: 2,
      });
    }
    
    return bottlenecks;
  }

  private calculateTeamMetrics(teamData: any): Record<string, number> {
    const pullRequests = teamData.pullRequests || [];
    const issues = teamData.issues || [];
    
    return {
      avgPRSize: pullRequests.length > 0 ? pullRequests.reduce((sum: number, pr: any) => sum + pr.size, 0) / pullRequests.length : 0,
      avgReviewTime: pullRequests.length > 0 ? pullRequests.reduce((sum: number, pr: any) => sum + pr.reviewTime, 0) / pullRequests.length : 0,
      deploymentFrequency: teamData.deployments?.length || 0,
      cycleTime: issues.length > 0 ? issues.reduce((sum: number, issue: any) => sum + issue.timeToResolve, 0) / issues.length : 0,
    };
  }

  private extractPredictions(analysis: string): Array<{ metric: string; prediction: string; confidence: number }> {
    return [
      {
        metric: 'velocity',
        prediction: 'Stable performance expected',
        confidence: 75,
      },
    ];
  }
}