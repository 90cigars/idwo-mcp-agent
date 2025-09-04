import { WebClient, LogLevel } from '@slack/web-api';
import logger from '../utils/logger.js';
import { ServiceError } from '../types/index.js';

export interface SlackConfig {
  botToken: string;
  appToken: string;
  signingSecret: string;
}

export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: Array<any>;
  attachments?: Array<any>;
  thread_ts?: string;
  reply_broadcast?: boolean;
}

export interface SlackChannel {
  id: string;
  name: string;
  isChannel: boolean;
  isGroup: boolean;
  isIm: boolean;
  isMember: boolean;
  isPrivate: boolean;
  memberCount?: number;
  purpose?: string;
  topic?: string;
}

export interface SlackUser {
  id: string;
  name: string;
  realName: string;
  displayName: string;
  email?: string;
  title?: string;
  team?: string;
  isBot: boolean;
  deleted: boolean;
}

export interface SlackMessageResponse {
  ts: string;
  channel: string;
  message: {
    text: string;
    user: string;
    ts: string;
  };
}

export class SlackIntegration {
  private client: WebClient;
  private config: SlackConfig;

  constructor(config: SlackConfig) {
    this.config = config;
    this.client = new WebClient(config.botToken, {
      logLevel: LogLevel.INFO,
      retryConfig: {
        retries: 3,
        factor: 2,
      },
    });
  }

  async sendMessage(message: SlackMessage): Promise<SlackMessageResponse> {
    try {
      const postArgs: any = {
        channel: message.channel,
        text: message.text,
        ...(message.blocks ? { blocks: message.blocks } : {}),
        ...(message.attachments ? { attachments: message.attachments } : {}),
        ...(message.thread_ts ? { thread_ts: message.thread_ts } : {}),
        ...(message.reply_broadcast !== undefined ? { reply_broadcast: message.reply_broadcast } : {}),
      };
      
      const response = await this.client.chat.postMessage(postArgs);

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.error}`);
      }

      logger.info('Sent Slack message', { 
        channel: message.channel, 
        ts: response.ts,
        threadTs: message.thread_ts 
      });

      return {
        ts: response.ts!,
        channel: response.channel!,
        message: {
          text: message.text,
          user: response.message?.user || 'bot',
          ts: response.ts!,
        },
      };
    } catch (error) {
      logger.error('Failed to send Slack message', { message, error });
      throw new ServiceError(`Failed to send Slack message: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'slack',
        retryable: true,
      });
    }
  }

  async sendNotification(channel: string, notification: {
    title: string;
    message: string;
    color?: 'good' | 'warning' | 'danger';
    fields?: Array<{ title: string; value: string; short?: boolean }>;
    actions?: Array<{ type: string; text: string; url?: string; value?: string }>;
  }): Promise<SlackMessageResponse> {
    try {
      const attachment = {
        color: notification.color || 'good',
        title: notification.title,
        text: notification.message,
        fields: notification.fields || [],
        ts: Math.floor(Date.now() / 1000),
      };

      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${notification.title}*\n${notification.message}`,
          },
        },
      ];

      if (notification.fields && notification.fields.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: notification.fields.map(field => `*${field.title}*: ${field.value}`).join('\n')
          }
        });
      }

      if (notification.actions && notification.actions.length > 0) {
        const actionElements = notification.actions.map(action => ({
          type: 'button' as const,
          text: {
            type: 'plain_text' as const,
            text: action.text,
          },
          ...(action.url ? { url: action.url } : {}),
          ...(action.value ? { value: action.value } : {}),
        }));

        (blocks as any).push({
          type: 'actions',
          elements: actionElements,
        });
      }

      return await this.sendMessage({
        channel,
        text: `${notification.title}: ${notification.message}`,
        blocks,
        attachments: [attachment],
      });
    } catch (error) {
      logger.error('Failed to send Slack notification', { channel, notification, error });
      throw error instanceof ServiceError ? error : new ServiceError(`Failed to send Slack notification: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'slack',
        retryable: true,
      });
    }
  }

  async updateMessage(channel: string, ts: string, message: {
    text: string;
    blocks?: Array<any>;
    attachments?: Array<any>;
  }): Promise<void> {
    try {
      const response = await this.client.chat.update({
        channel,
        ts,
        text: message.text,
        blocks: message.blocks,
        attachments: message.attachments,
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.error}`);
      }

      logger.info('Updated Slack message', { channel, ts });
    } catch (error) {
      logger.error('Failed to update Slack message', { channel, ts, error });
      throw new ServiceError(`Failed to update Slack message: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'slack',
        retryable: true,
      });
    }
  }

  async getChannelInfo(channel: string): Promise<SlackChannel> {
    try {
      const response = await this.client.conversations.info({
        channel,
        include_num_members: true,
      });

      if (!response.ok || !response.channel) {
        throw new Error(`Slack API error: ${response.error || 'Channel not found'}`);
      }

      const ch = response.channel;

      return {
        id: ch.id!,
        name: ch.name || '',
        isChannel: ch.is_channel || false,
        isGroup: ch.is_group || false,
        isIm: ch.is_im || false,
        isMember: ch.is_member || false,
        isPrivate: ch.is_private || false,
        memberCount: ch.num_members,
        purpose: ch.purpose?.value,
        topic: ch.topic?.value,
      };
    } catch (error) {
      logger.error('Failed to get Slack channel info', { channel, error });
      throw new ServiceError(`Failed to get Slack channel info: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'slack',
        retryable: true,
      });
    }
  }

  async getUserInfo(userId: string): Promise<SlackUser> {
    try {
      const response = await this.client.users.info({
        user: userId,
      });

      if (!response.ok || !response.user) {
        throw new Error(`Slack API error: ${response.error || 'User not found'}`);
      }

      const user = response.user;
      const profile = user.profile || {};

      return {
        id: user.id!,
        name: user.name || '',
        realName: user.real_name || profile.real_name || '',
        displayName: profile.display_name || user.name || '',
        email: profile.email,
        title: profile.title,
        team: user.team_id,
        isBot: user.is_bot || false,
        deleted: user.deleted || false,
      };
    } catch (error) {
      logger.error('Failed to get Slack user info', { userId, error });
      throw new ServiceError(`Failed to get Slack user info: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'slack',
        retryable: true,
      });
    }
  }

  async findChannelByName(channelName: string): Promise<SlackChannel | null> {
    try {
      const response = await this.client.conversations.list({
        types: 'public_channel,private_channel',
        limit: 1000,
      });

      if (!response.ok || !response.channels) {
        throw new Error(`Slack API error: ${response.error}`);
      }

      const channel = response.channels.find(ch => ch.name === channelName.replace('#', ''));
      
      if (!channel) {
        return null;
      }

      return {
        id: channel.id!,
        name: channel.name || '',
        isChannel: channel.is_channel || false,
        isGroup: channel.is_group || false,
        isIm: channel.is_im || false,
        isMember: channel.is_member || false,
        isPrivate: channel.is_private || false,
        memberCount: channel.num_members,
        purpose: channel.purpose?.value,
        topic: channel.topic?.value,
      };
    } catch (error) {
      logger.error('Failed to find Slack channel by name', { channelName, error });
      throw new ServiceError(`Failed to find Slack channel by name: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'slack',
        retryable: true,
      });
    }
  }

  async createWorkflowNotification(channel: string, workflow: {
    id: string;
    type: 'pr' | 'issue' | 'release';
    title: string;
    description: string;
    status: string;
    url?: string;
    assignee?: string;
    priority?: string;
  }): Promise<SlackMessageResponse> {
    const statusColor = this.getStatusColor(workflow.status);
    const emoji = this.getWorkflowEmoji(workflow.type);

    const fields = [
      { title: 'Status', value: workflow.status, short: true },
      { title: 'Type', value: workflow.type.toUpperCase(), short: true },
    ];

    if (workflow.assignee) {
      fields.push({ title: 'Assignee', value: workflow.assignee, short: true });
    }

    if (workflow.priority) {
      fields.push({ title: 'Priority', value: workflow.priority, short: true });
    }

    const actions = [];
    if (workflow.url) {
      actions.push({
        type: 'button',
        text: `View ${workflow.type.toUpperCase()}`,
        url: workflow.url,
      });
    }

    return await this.sendNotification(channel, {
      title: `${emoji} ${workflow.title}`,
      message: workflow.description,
      color: statusColor,
      fields,
      actions,
    });
  }

  async sendTeamReport(channel: string, report: {
    title: string;
    period: string;
    metrics: Array<{ name: string; value: string; trend?: string }>;
    highlights: string[];
    recommendations: string[];
  }): Promise<SlackMessageResponse> {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: report.title,
        },
      },
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `📅 *Period:* ${report.period}`,
        }],
      },
      {
        type: 'divider',
      },
    ];

    if (report.metrics.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*📊 Key Metrics*',
        },
      });

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: report.metrics.slice(0, 10).map(metric => 
            `*${metric.name}*: ${metric.value}${metric.trend ? ` ${metric.trend}` : ''}`
          ).join('\n')
        }
      });
    }

    if (report.highlights.length > 0) {
      blocks.push(
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*🎯 Highlights*\n${report.highlights.map(h => `• ${h}`).join('\n')}`,
          },
        }
      );
    }

    if (report.recommendations.length > 0) {
      blocks.push(
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*💡 Recommendations*\n${report.recommendations.map(r => `• ${r}`).join('\n')}`,
          },
        }
      );
    }

    return await this.sendMessage({
      channel,
      text: report.title,
      blocks,
    });
  }

  private getStatusColor(status: string): 'good' | 'warning' | 'danger' {
    const lowerStatus = status.toLowerCase();
    
    if (lowerStatus.includes('success') || lowerStatus.includes('done') || lowerStatus.includes('merged') || lowerStatus.includes('closed')) {
      return 'good';
    }
    
    if (lowerStatus.includes('warning') || lowerStatus.includes('review') || lowerStatus.includes('pending')) {
      return 'warning';
    }
    
    if (lowerStatus.includes('error') || lowerStatus.includes('failed') || lowerStatus.includes('blocked')) {
      return 'danger';
    }
    
    return 'good';
  }

  private getWorkflowEmoji(type: string): string {
    switch (type) {
      case 'pr':
        return '🔀';
      case 'issue':
        return '🐛';
      case 'release':
        return '🚀';
      default:
        return '⚡';
    }
  }
}