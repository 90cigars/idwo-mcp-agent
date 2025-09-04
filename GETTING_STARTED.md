# Getting Started with IDWO

This guide will help you get the Intelligent Development Workflow Orchestrator up and running quickly.

## Prerequisites

- **Node.js 22+** (recommended: use nvm for version management)
- **Git** for version control
- **API Keys** for the services you want to integrate

## Quick Setup (5 minutes)

### 1. Installation
```bash
git clone https://github.com/90cigars/idwo-mcp-agent.git
cd idwo-mcp-agent
npm install
```

### 2. Configuration
```bash
cp .env.example .env
# Edit .env with your API keys (see Configuration section below)
```

### 3. Build and Test
```bash
npm run build
npm test
```

### 4. Start Development Server
```bash
npm run dev
```

## Essential Configuration

### Required API Keys

Add these to your `.env` file:

```env
# OpenAI (required for AI analysis)
OPENAI_API_KEY=sk-your-openai-api-key-here

# GitHub (required for PR analysis)
GITHUB_TOKEN=ghp_your-github-token-here

# JIRA (required for issue management)
JIRA_URL=https://your-domain.atlassian.net
JIRA_USERNAME=your-email@company.com
JIRA_API_TOKEN=your-jira-api-token

# Slack (required for notifications)
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
```

### API Key Setup Instructions

#### OpenAI
1. Visit https://platform.openai.com/api-keys
2. Create a new API key
3. Add to `.env` as `OPENAI_API_KEY`

#### GitHub
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a token with `repo`, `read:org`, and `read:user` permissions
3. Add to `.env` as `GITHUB_TOKEN`

#### JIRA
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Create an API token
3. Add your JIRA URL, username, and token to `.env`

#### Slack
1. Visit https://api.slack.com/apps and create a new app
2. Add Bot Token Scopes: `chat:write`, `channels:read`, `users:read`
3. Install the app to your workspace
4. Copy the Bot User OAuth Token to `.env`

## Verify Installation

### Test Basic Functionality
```bash
# Check if the server starts
npm run dev

# In another terminal, test the build
npm run build

# Run the test suite
npm test
```

### Test MCP Integration

1. **With Claude Code**: Add to your MCP server configuration
2. **With ChatGPT**: Use compatible MCP client
3. **With any MCP client**: Connect to the server endpoint

## First Workflow

Try analyzing a pull request:

```typescript
// Example MCP tool call
{
  "tool": "analyze_pr",
  "arguments": {
    "owner": "your-github-org",
    "repo": "your-repo",
    "pull_number": 123
  }
}
```

## Development Workflow

### File Structure
```
src/
├── agents/          # AI analysis logic
├── integrations/    # Service API clients
├── tools/          # MCP tool definitions
├── workflows/      # Orchestration logic
└── server.ts       # Main MCP server

tests/
├── integrations/   # Integration tests
└── workflows/      # Workflow tests
```

### Common Commands
```bash
npm run dev          # Development with hot reload
npm run build        # Production build
npm run test         # Run all tests
npm run test:watch   # Watch mode for tests
npm run lint         # Code linting
npm run type-check   # TypeScript checking
```

### Making Changes

1. **Add a new tool**: Create in `src/tools/` and register in `src/server.ts`
2. **Add a service integration**: Create client in `src/integrations/`
3. **Add AI analysis**: Extend `src/agents/openai.ts`
4. **Add workflow logic**: Update `src/workflows/orchestrator.ts`

## Docker Development

```bash
# Start with all dependencies
docker-compose up -d

# Development with hot reload
docker-compose -f docker-compose.dev.yml up

# Production build
docker-compose -f docker-compose.prod.yml up -d
```

## Production Deployment

### Option 1: Docker
```bash
docker build -t idwo-mcp-server .
docker run -d -p 3000:3000 --env-file .env idwo-mcp-server
```

### Option 2: Kubernetes
```bash
kubectl apply -f deployment/k8s/
# Or with Helm:
helm install idwo deployment/helm/idwo-chart/
```

### Option 3: Cloud Functions
```bash
npm run build:serverless
# Deploy using your cloud provider's CLI
```

## Troubleshooting

### Common Issues

**Build Errors**
- Ensure Node.js 22+ is installed
- Run `npm install` to update dependencies
- Check TypeScript configuration

**API Connection Issues**
- Verify API keys are correct and have proper permissions
- Check network connectivity
- Review service-specific documentation

**MCP Client Issues**
- Ensure MCP client supports the protocol version
- Check server logs for connection errors
- Verify tool schemas match client expectations

### Getting Help

- **Documentation**: Check README.md and ARCHITECTURE.md
- **Issues**: Create an issue in the GitHub repository
- **Discussions**: Use GitHub Discussions for questions
- **Logs**: Check `logs/` directory for detailed error information

## Next Steps

1. **Customize Tools**: Modify existing tools for your workflow
2. **Add Integrations**: Connect additional services
3. **Extend AI Analysis**: Enhance the intelligence capabilities
4. **Configure Monitoring**: Set up observability and alerting
5. **Scale Deployment**: Move to production infrastructure

## Success Metrics

You'll know the setup is working when:
- ✅ Server starts without errors
- ✅ All tests pass
- ✅ MCP client can connect and list tools
- ✅ First workflow execution completes successfully
- ✅ Logs show successful API connections

Happy automating! 🚀