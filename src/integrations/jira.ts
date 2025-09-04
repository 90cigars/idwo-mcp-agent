import axios, { AxiosInstance, AxiosError } from 'axios';
import logger from '../utils/logger.js';
import { ServiceError } from '../types/index.js';

export interface JiraConfig {
  url: string;
  username: string;
  apiToken: string;
}

export interface JiraIssue {
  key: string;
  id: string;
  summary: string;
  description: string;
  issueType: string;
  status: string;
  priority: string;
  assignee?: string;
  reporter: string;
  created: string;
  updated: string;
  labels: string[];
  components: string[];
  fixVersions: string[];
  sprint?: string;
  storyPoints?: number;
  customFields: Record<string, any>;
  comments: Array<{
    author: string;
    body: string;
    created: string;
  }>;
  worklog: Array<{
    author: string;
    timeSpent: string;
    description: string;
    started: string;
  }>;
}

export interface JiraProject {
  key: string;
  name: string;
  description: string;
  projectType: string;
  lead: string;
  components: Array<{ name: string; description: string; lead?: string }>;
  versions: Array<{ name: string; released: boolean; releaseDate?: string }>;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'future' | 'active' | 'closed';
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  goal?: string;
}

export class JiraIntegration {
  private client: AxiosInstance;
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: `${config.url}/rest/api/3`,
      auth: {
        username: config.username,
        password: config.apiToken,
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'IDWO-MCP-Server/1.0.0',
      },
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        logger.error('JIRA API error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
        });

        throw new ServiceError(`JIRA API error: ${error.message}`, {
          service: 'jira',
          statusCode: error.response?.status,
          retryable: error.response?.status ? error.response.status >= 500 : true,
        });
      }
    );
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    try {
      const response = await this.client.get(`/issue/${issueKey}`, {
        params: {
          expand: 'changelog,worklog,comments',
          fields: 'summary,description,issuetype,status,priority,assignee,reporter,created,updated,labels,components,fixVersions,customfield_10020,customfield_10021,comment,worklog',
        },
      });

      const issue = response.data;
      const fields = issue.fields;

      return {
        key: issue.key,
        id: issue.id,
        summary: fields.summary || '',
        description: fields.description?.content?.[0]?.content?.[0]?.text || '',
        issueType: fields.issuetype?.name || 'Unknown',
        status: fields.status?.name || 'Unknown',
        priority: fields.priority?.name || 'Medium',
        assignee: fields.assignee?.displayName,
        reporter: fields.reporter?.displayName || 'Unknown',
        created: fields.created,
        updated: fields.updated,
        labels: fields.labels || [],
        components: fields.components?.map((c: any) => c.name) || [],
        fixVersions: fields.fixVersions?.map((v: any) => v.name) || [],
        sprint: fields.customfield_10020?.[0]?.name,
        storyPoints: fields.customfield_10021,
        customFields: this.extractCustomFields(fields),
        comments: fields.comment?.comments?.map((comment: any) => ({
          author: comment.author?.displayName || 'Unknown',
          body: comment.body?.content?.[0]?.content?.[0]?.text || '',
          created: comment.created,
        })) || [],
        worklog: fields.worklog?.worklogs?.map((log: any) => ({
          author: log.author?.displayName || 'Unknown',
          timeSpent: log.timeSpent,
          description: log.comment?.content?.[0]?.content?.[0]?.text || '',
          started: log.started,
        })) || [],
      };
    } catch (error) {
      logger.error('Failed to fetch JIRA issue', { issueKey, error });
      throw error instanceof ServiceError ? error : new ServiceError(`Failed to fetch JIRA issue: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'jira',
        retryable: true,
      });
    }
  }

  async createIssue(projectKey: string, issueData: {
    summary: string;
    description: string;
    issueType: string;
    priority?: string;
    assignee?: string;
    labels?: string[];
    components?: string[];
  }): Promise<JiraIssue> {
    try {
      const payload = {
        fields: {
          project: { key: projectKey },
          summary: issueData.summary,
          description: {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: issueData.description }],
            }],
          },
          issuetype: { name: issueData.issueType },
          priority: issueData.priority ? { name: issueData.priority } : undefined,
          assignee: issueData.assignee ? { name: issueData.assignee } : undefined,
          labels: issueData.labels || [],
          components: issueData.components?.map(name => ({ name })) || [],
        },
      };

      const response = await this.client.post('/issue', payload);
      const createdKey = response.data.key;

      return await this.getIssue(createdKey);
    } catch (error) {
      logger.error('Failed to create JIRA issue', { projectKey, issueData, error });
      throw error instanceof ServiceError ? error : new ServiceError(`Failed to create JIRA issue: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'jira',
        retryable: false,
      });
    }
  }

  async updateIssueStatus(issueKey: string, transitionName: string): Promise<void> {
    try {
      const transitionsResponse = await this.client.get(`/issue/${issueKey}/transitions`);
      const transition = transitionsResponse.data.transitions.find((t: any) => 
        t.name.toLowerCase() === transitionName.toLowerCase()
      );

      if (!transition) {
        throw new Error(`Transition '${transitionName}' not found for issue ${issueKey}`);
      }

      await this.client.post(`/issue/${issueKey}/transitions`, {
        transition: { id: transition.id },
      });

      logger.info('Updated JIRA issue status', { issueKey, transitionName });
    } catch (error) {
      logger.error('Failed to update JIRA issue status', { issueKey, transitionName, error });
      throw error instanceof ServiceError ? error : new ServiceError(`Failed to update JIRA issue status: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'jira',
        retryable: true,
      });
    }
  }

  async searchIssues(jql: string, maxResults = 50): Promise<JiraIssue[]> {
    try {
      const response = await this.client.post('/search', {
        jql,
        maxResults,
        fields: ['key', 'summary', 'status', 'assignee', 'priority', 'created', 'updated'],
      });

      const issues = await Promise.all(
        response.data.issues.map((issue: any) => this.getIssue(issue.key))
      );

      return issues;
    } catch (error) {
      logger.error('Failed to search JIRA issues', { jql, error });
      throw error instanceof ServiceError ? error : new ServiceError(`Failed to search JIRA issues: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'jira',
        retryable: true,
      });
    }
  }

  async getProject(projectKey: string): Promise<JiraProject> {
    try {
      const [projectResponse, componentsResponse, versionsResponse] = await Promise.all([
        this.client.get(`/project/${projectKey}`),
        this.client.get(`/project/${projectKey}/components`),
        this.client.get(`/project/${projectKey}/versions`),
      ]);

      const project = projectResponse.data;

      return {
        key: project.key,
        name: project.name,
        description: project.description || '',
        projectType: project.projectTypeKey,
        lead: project.lead?.displayName || 'Unknown',
        components: componentsResponse.data.map((c: any) => ({
          name: c.name,
          description: c.description || '',
          lead: c.lead?.displayName,
        })),
        versions: versionsResponse.data.map((v: any) => ({
          name: v.name,
          released: v.released,
          releaseDate: v.releaseDate,
        })),
      };
    } catch (error) {
      logger.error('Failed to fetch JIRA project', { projectKey, error });
      throw error instanceof ServiceError ? error : new ServiceError(`Failed to fetch JIRA project: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'jira',
        retryable: true,
      });
    }
  }

  async getActiveSprintsForBoard(boardId: number): Promise<JiraSprint[]> {
    try {
      const response = await this.client.get(`/board/${boardId}/sprint`, {
        params: { state: 'active' },
      });

      return response.data.values.map((sprint: any) => ({
        id: sprint.id,
        name: sprint.name,
        state: sprint.state,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        completeDate: sprint.completeDate,
        goal: sprint.goal,
      }));
    } catch (error) {
      logger.error('Failed to fetch active sprints', { boardId, error });
      throw error instanceof ServiceError ? error : new ServiceError(`Failed to fetch active sprints: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'jira',
        retryable: true,
      });
    }
  }

  async addCommentToIssue(issueKey: string, comment: string): Promise<void> {
    try {
      await this.client.post(`/issue/${issueKey}/comment`, {
        body: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: comment }],
          }],
        },
      });

      logger.info('Added comment to JIRA issue', { issueKey });
    } catch (error) {
      logger.error('Failed to add comment to JIRA issue', { issueKey, error });
      throw error instanceof ServiceError ? error : new ServiceError(`Failed to add comment to JIRA issue: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'jira',
        retryable: true,
      });
    }
  }

  async getProjectIssueStats(projectKey: string, daysBack = 30): Promise<{
    totalIssues: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byAssignee: Record<string, number>;
    completedInPeriod: number;
    createdInPeriod: number;
  }> {
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - daysBack);
      const since = sinceDate.toISOString().split('T')[0];

      const jqlQueries = [
        `project = ${projectKey}`,
        `project = ${projectKey} AND status changed TO ("Done", "Closed", "Resolved") AFTER "${since}"`,
        `project = ${projectKey} AND created >= "${since}"`,
      ];

      const [allIssues, completedIssues, newIssues] = await Promise.all(
        jqlQueries.map(jql => this.searchIssues(jql, 1000))
      );

      const byStatus: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      const byAssignee: Record<string, number> = {};

      if (allIssues) {
        allIssues.forEach(issue => {
        byStatus[issue.status] = (byStatus[issue.status] || 0) + 1;
        byPriority[issue.priority] = (byPriority[issue.priority] || 0) + 1;
        const assignee = issue.assignee || 'Unassigned';
        byAssignee[assignee] = (byAssignee[assignee] || 0) + 1;
        });
      }

      return {
        totalIssues: allIssues?.length || 0,
        byStatus,
        byPriority,
        byAssignee,
        completedInPeriod: completedIssues?.length || 0,
        createdInPeriod: newIssues?.length || 0,
      };
    } catch (error) {
      logger.error('Failed to fetch project issue stats', { projectKey, error });
      throw error instanceof ServiceError ? error : new ServiceError(`Failed to fetch project issue stats: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'jira',
        retryable: true,
      });
    }
  }

  private extractCustomFields(fields: any): Record<string, any> {
    const customFields: Record<string, any> = {};
    
    Object.keys(fields).forEach(key => {
      if (key.startsWith('customfield_')) {
        const value = fields[key];
        if (value !== null && value !== undefined) {
          customFields[key] = value;
        }
      }
    });

    return customFields;
  }
}