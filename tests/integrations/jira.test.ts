import axios from 'axios';
import { JiraIntegration } from '../../src/integrations/jira.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('JiraIntegration', () => {
  let jira: JiraIntegration;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn(),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    jira = new JiraIntegration({
      url: 'https://test.atlassian.net',
      username: 'test@example.com',
      apiToken: 'test-token',
    });
  });

  describe('getIssue', () => {
    it('should fetch and format issue details correctly', async () => {
      const mockIssueData = {
        data: {
          key: 'PROJ-123',
          id: '12345',
          fields: {
            summary: 'Test Issue',
            description: {
              content: [{
                content: [{ text: 'Issue description' }]
              }]
            },
            issuetype: { name: 'Bug' },
            status: { name: 'Open' },
            priority: { name: 'High' },
            assignee: { displayName: 'John Doe' },
            reporter: { displayName: 'Jane Smith' },
            created: '2023-01-01T00:00:00Z',
            updated: '2023-01-02T00:00:00Z',
            labels: ['bug', 'urgent'],
            components: [{ name: 'frontend' }],
            fixVersions: [{ name: '1.0.0' }],
            customfield_10020: [{ name: 'Sprint 1' }],
            customfield_10021: 5,
            comment: {
              comments: [{
                author: { displayName: 'Commenter' },
                body: { content: [{ content: [{ text: 'Test comment' }] }] },
                created: '2023-01-01T12:00:00Z',
              }]
            },
            worklog: {
              worklogs: [{
                author: { displayName: 'Worker' },
                timeSpent: '2h',
                comment: { content: [{ content: [{ text: 'Work done' }] }] },
                started: '2023-01-01T09:00:00Z',
              }]
            }
          }
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockIssueData);

      const result = await jira.getIssue('PROJ-123');

      expect(result).toMatchObject({
        key: 'PROJ-123',
        id: '12345',
        summary: 'Test Issue',
        description: 'Issue description',
        issueType: 'Bug',
        status: 'Open',
        priority: 'High',
        assignee: 'John Doe',
        reporter: 'Jane Smith',
        labels: ['bug', 'urgent'],
        components: ['frontend'],
        fixVersions: ['1.0.0'],
        sprint: 'Sprint 1',
        storyPoints: 5,
      });

      expect(result.comments).toHaveLength(1);
      expect(result.worklog).toHaveLength(1);
    });

    it('should handle missing optional fields', async () => {
      const mockIssueData = {
        data: {
          key: 'PROJ-124',
          id: '12346',
          fields: {
            summary: 'Minimal Issue',
            issuetype: { name: 'Task' },
            status: { name: 'TODO' },
            reporter: { displayName: 'Reporter' },
            created: '2023-01-01T00:00:00Z',
            updated: '2023-01-01T00:00:00Z',
            labels: [],
          }
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockIssueData);

      const result = await jira.getIssue('PROJ-124');

      expect(result).toMatchObject({
        key: 'PROJ-124',
        summary: 'Minimal Issue',
        description: '',
        priority: 'Medium', // Default value
        assignee: undefined,
        components: [],
        fixVersions: [],
        comments: [],
        worklog: [],
      });
    });
  });

  describe('createIssue', () => {
    it('should create an issue successfully', async () => {
      const mockCreateResponse = {
        data: { key: 'PROJ-125' }
      };

      const mockGetResponse = {
        data: {
          key: 'PROJ-125',
          id: '12347',
          fields: {
            summary: 'New Issue',
            issuetype: { name: 'Bug' },
            status: { name: 'Open' },
            reporter: { displayName: 'Creator' },
            created: '2023-01-03T00:00:00Z',
            updated: '2023-01-03T00:00:00Z',
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockCreateResponse);
      mockAxiosInstance.get.mockResolvedValue(mockGetResponse);

      const issueData = {
        summary: 'New Issue',
        description: 'Issue description',
        issueType: 'Bug',
        priority: 'High',
        labels: ['new', 'bug'],
      };

      const result = await jira.createIssue('PROJ', issueData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/issue', {
        fields: {
          project: { key: 'PROJ' },
          summary: 'New Issue',
          description: expect.objectContaining({
            type: 'doc',
            version: 1,
          }),
          issuetype: { name: 'Bug' },
          priority: { name: 'High' },
          labels: ['new', 'bug'],
          components: [],
        }
      });

      expect(result.key).toBe('PROJ-125');
    });
  });

  describe('updateIssueStatus', () => {
    it('should transition issue status successfully', async () => {
      const mockTransitionsResponse = {
        data: {
          transitions: [
            { id: '11', name: 'Done' },
            { id: '21', name: 'In Progress' }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockTransitionsResponse);
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      await jira.updateIssueStatus('PROJ-123', 'Done');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/issue/PROJ-123/transitions');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/issue/PROJ-123/transitions', {
        transition: { id: '11' }
      });
    });

    it('should throw error for invalid transition', async () => {
      const mockTransitionsResponse = {
        data: {
          transitions: [
            { id: '11', name: 'Done' }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockTransitionsResponse);

      await expect(jira.updateIssueStatus('PROJ-123', 'Invalid Status'))
        .rejects.toThrow('Transition \'Invalid Status\' not found for issue PROJ-123');
    });
  });

  describe('searchIssues', () => {
    it('should search and return issues', async () => {
      const mockSearchResponse = {
        data: {
          issues: [
            { key: 'PROJ-123' },
            { key: 'PROJ-124' }
          ]
        }
      };

      const mockIssueResponse = {
        data: {
          key: 'PROJ-123',
          id: '12345',
          fields: {
            summary: 'Found Issue',
            issuetype: { name: 'Bug' },
            status: { name: 'Open' },
            reporter: { displayName: 'Reporter' },
            created: '2023-01-01T00:00:00Z',
            updated: '2023-01-01T00:00:00Z',
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockSearchResponse);
      mockAxiosInstance.get.mockResolvedValue(mockIssueResponse);

      const result = await jira.searchIssues('project = PROJ', 10);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/search', {
        jql: 'project = PROJ',
        maxResults: 10,
        fields: ['key', 'summary', 'status', 'assignee', 'priority', 'created', 'updated'],
      });

      expect(result).toHaveLength(2);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });
  });
});