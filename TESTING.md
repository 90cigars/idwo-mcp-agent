# Testing Guide for IDWO MCP Server

This guide covers all testing approaches for the Intelligent Development Workflow Orchestrator.

## 🚀 Quick Test Commands

```bash
# Basic functionality tests
npm test                    # Unit tests
npm run test:integration    # Integration tests
npm run test:apis          # API connectivity tests
npm run test:tools         # MCP tool functionality tests
npm run test:all           # Everything

# Development tests
npm run test:watch         # Watch mode for TDD
npm test -- --coverage     # Coverage report
npm run lint              # Code quality
npm run type-check        # TypeScript validation
```

## 🎯 Testing Levels

### 1. **Unit Tests** - Component Testing

**What they test:** Individual functions and classes in isolation
**Speed:** Fast (< 1 second per test)
**Dependencies:** All external services mocked

```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- tests/integrations/github.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should fetch PR details"

# Generate coverage report
npm test -- --coverage
```

**Example output:**
```
✓ GitHubIntegration › should fetch and format PR details correctly
✓ JiraIntegration › should create an issue successfully  
✓ WorkflowOrchestrator › should analyze PR successfully

Test Suites: 3 passed, 3 total
Tests: 15 passed, 15 total
Coverage: 92.3%
```

### 2. **Integration Tests** - End-to-End Testing

**What they test:** Complete workflows with real or realistic data
**Speed:** Medium (5-30 seconds per test)
**Dependencies:** May use real APIs or sophisticated mocks

```bash
# Run integration tests
npm run test:integration

# Run with real services (requires API keys)
INTEGRATION_TEST=true npm run test:integration
```

### 3. **API Connectivity Tests** - Service Verification

**What they test:** Actual API connections and responses
**Speed:** Medium (depends on API response times)
**Dependencies:** Real API keys required

```bash
# Test all API connections
npm run test:apis
```

**Example output:**
```
🧪 Testing API Integrations...

Testing GitHub API...
✅ GitHub API working - Contributors: 5

Testing JIRA API...  
✅ JIRA API working - Project: My Project

Testing Slack API...
✅ Slack API working - Found channel: general

Testing OpenAI API...
✅ OpenAI API working - Confidence: 85

🏁 API Testing Complete!
```

### 4. **MCP Tool Tests** - Workflow Validation

**What they test:** Complete MCP tool functionality
**Speed:** Slow (30+ seconds per test)
**Dependencies:** All real APIs required

```bash
# Test MCP tool functionality
npm run test:tools
```

**Example output:**
```
🛠️ Testing MCP Tools...

Testing analyze_pr tool...
✅ analyze_pr working
   Risk Level: medium
   Suggested Reviewers: 2

Testing smart_triage tool...
✅ smart_triage working  
   Priority: high
   Estimated Effort: 5

Testing get_team_insights tool...
✅ get_team_insights working
   Velocity Trend: increasing
   Bottlenecks Found: 1

🏁 MCP Tools Testing Complete!
```

## 🔧 Test Configuration

### Environment Setup

1. **Create test environment file:**
   ```bash
   cp .env.example .env.test
   ```

2. **Configure test-specific values:**
   ```env
   # .env.test
   NODE_ENV=test
   LOG_LEVEL=error
   
   # Use test/sandbox API keys where possible
   OPENAI_API_KEY=sk-test-key
   GITHUB_TOKEN=ghp_test-token
   JIRA_URL=https://test-instance.atlassian.net
   SLACK_BOT_TOKEN=xoxb-test-token
   
   # Test database (optional)
   DATABASE_URL=postgresql://test:test@localhost:5432/idwo_test
   REDIS_URL=redis://localhost:6379/1
   ```

### Test Data Setup

For integration tests, you may need:

1. **GitHub Test Repository:**
   ```env
   TEST_GITHUB_OWNER=octocat
   TEST_GITHUB_REPO=Hello-World
   TEST_GITHUB_PR=1
   ```

2. **JIRA Test Issue:**
   ```env
   TEST_JIRA_PROJECT=TEST
   TEST_JIRA_ISSUE=TEST-1
   ```

3. **Slack Test Channel:**
   ```env
   TEST_SLACK_CHANNEL=test-notifications
   ```

## 🐛 Testing Scenarios

### Happy Path Testing

```bash
# Test successful workflows
npm run test:tools

# Should show all green checkmarks
```

### Error Handling Testing

```bash
# Test with invalid API keys
GITHUB_TOKEN=invalid npm run test:apis

# Test with non-existent resources  
TEST_JIRA_ISSUE=NONEXISTENT-999 npm run test:tools
```

### Performance Testing

```bash
# Run tests with timing
npm test -- --verbose

# Load testing (if implemented)
npm run test:load
```

## 🔍 Debugging Tests

### Debug Individual Tests

```bash
# Run specific test with debug output
NODE_OPTIONS="--inspect-brk" npm test -- --runInBand tests/specific.test.ts

# Show detailed logs during testing
VERBOSE=true npm test
```

### Debug API Connectivity

```bash
# Enable detailed logging
LOG_LEVEL=debug npm run test:apis

# Test individual service
node -e "
import { GitHubIntegration } from './dist/integrations/github.js';
const gh = new GitHubIntegration({ token: 'your-token' });
gh.getRepositoryStats('owner', 'repo').then(console.log);
"
```

### Debug MCP Protocol

```bash
# Start server in debug mode
DEBUG=mcp:* npm run dev

# Test MCP connection manually
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | nc localhost 3000
```

## 📊 Test Coverage

### Generate Coverage Reports

```bash
# HTML coverage report
npm test -- --coverage --coverageReporters=html
open coverage/lcov-report/index.html

# Text coverage summary
npm test -- --coverage --coverageReporters=text

# Coverage for specific files
npm test -- --coverage --collectCoverageFrom="src/workflows/**"
```

### Coverage Targets

- **Unit Tests:** 90%+ line coverage
- **Integration Tests:** 80%+ feature coverage  
- **Critical Paths:** 100% coverage for security and error handling

## 🚨 Continuous Testing

### Pre-commit Testing

```bash
# Add to your git hooks
npm run type-check && npm run lint && npm test
```

### CI/CD Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint  
      - run: npm test
      - run: npm run test:integration
```

## 🔧 Common Issues & Solutions

### Test Failures

**Issue:** "Cannot find module 'tslib'"
```bash
Solution: npm install --save-dev tslib
```

**Issue:** "Jest encountered an unexpected token"
```bash
Solution: Check jest.config.js moduleNameMapper configuration
```

**Issue:** "API rate limit exceeded"
```bash
Solution: Use test API keys or implement request throttling
```

### Performance Issues

**Issue:** Tests running slowly
```bash
# Run tests in parallel
npm test -- --maxWorkers=4

# Run only changed tests
npm test -- --onlyChanged
```

**Issue:** API timeouts in tests
```bash
# Increase test timeout
npm test -- --testTimeout=30000
```

### API Connectivity Issues

**Issue:** "GitHub API authentication failed"
```bash
# Verify token permissions
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user
```

**Issue:** "JIRA API connection refused"
```bash
# Test JIRA connectivity
curl -u "$JIRA_USERNAME:$JIRA_API_TOKEN" "$JIRA_URL/rest/api/3/myself"
```

## 📚 Test Development Guidelines

### Writing New Tests

1. **Follow the AAA pattern:** Arrange, Act, Assert
2. **Use descriptive test names:** `should return formatted PR details when valid PR number provided`
3. **Mock external dependencies:** Use Jest mocks for APIs
4. **Test edge cases:** Empty responses, network failures, invalid inputs
5. **Keep tests independent:** Each test should be able to run in isolation

### Test Organization

```
tests/
├── unit/
│   ├── integrations/    # API client tests
│   ├── agents/         # AI agent tests  
│   └── workflows/      # Orchestration tests
├── integration/
│   ├── end-to-end/     # Full workflow tests
│   └── api/           # Real API tests
└── fixtures/          # Test data and mocks
```

This comprehensive testing approach ensures reliability, performance, and maintainability of the IDWO MCP Server.