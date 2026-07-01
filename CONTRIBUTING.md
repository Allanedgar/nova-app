# Contributing to ARBITRAGE-PRO

Thank you for your interest in contributing to ARBITRAGE-PRO. This document provides guidelines and instructions for contributing.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [AI Contributions](#ai-contributions)
- [Community](#community)

---

## Code of Conduct

By participating, you agree to abide by our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/core.git`
3. Add upstream remote: `git remote add upstream https://github.com/arbitrage-pro/core.git`
4. Create a branch: `git checkout -b feature/your-feature-name`
5. Make your changes
6. Push to your fork: `git push origin feature/your-feature-name`
7. Open a Pull Request

---

## How to Contribute

### Reporting Bugs

- Search [existing issues](https://github.com/arbitrage-pro/core/issues) first
- Use the bug report template
- Include steps to reproduce
- Include environment details (OS, Node version, etc.)
- Include logs and error messages

### Suggesting Features

- Search [existing issues](https://github.com/arbitrage-pro/core/issues) first
- Use the feature request template
- Explain the problem you're solving
- Provide use cases
- Consider implementation complexity

### Contributing Code

1. Check [project roadmap](docs/26_PROJECT_ROADMAP.md) for priorities
2. Look for [good first issues](https://github.com/arbitrage-pro/core/labels/good%20first%20issue)
3. Comment on the issue to claim it
4. Follow the PR process below

---

## Development Setup

### Prerequisites

- Node.js 22+
- PostgreSQL 16+
- Redis 7+
- pnpm 8+
- Git

### Setup Steps

```bash
# Clone repository
git clone https://github.com/arbitrage-pro/core.git
cd core

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up database
createdb arbitrage_pro
pnpm db:migrate
pnpm db:seed

# Start development servers
pnpm dev

# Run tests
pnpm test
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://localhost:5432/arbitrage_pro

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_PRIVATE_KEY=your-private-key
JWT_PUBLIC_KEY=your-public-key

# API Keys (for testing)
BINANCE_API_KEY=your-key
BINANCE_API_SECRET=your-secret
```

---

## Pull Request Process

### 1. Before You Start

- [ ] Check for existing PRs addressing the same issue
- [ ] Comment on the issue to coordinate with maintainers
- [ ] Ensure the issue is approved for implementation

### 2. Development

- [ ] Create a feature branch from `main`
- [ ] Follow [coding standards](#coding-standards)
- [ ] Write tests (see [testing requirements](#testing-requirements))
- [ ] Update documentation

### 3. Pre-Submission Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm format` applied
- [ ] `pnpm test` passes
- [ ] `pnpm test:integration` passes (if applicable)
- [ ] All new code has tests (≥80% coverage)
- [ ] Documentation updated

### 4. PR Submission

- [ ] Fill out the PR template completely
- [ ] Link to the issue being resolved
- [ ] Provide a clear description of changes
- [ ] Include screenshots for UI changes
- [ ] Keep PRs focused (one feature per PR)

### 5. Review Process

1. Automated CI checks run
2. At least one maintainer reviews
3. Feedback is addressed
4. Approval granted
5. Maintainer merges

### 6. After Merge

- Delete your feature branch
- Pull latest from upstream
- Celebrate! 🎉

---

## Coding Standards

### TypeScript

```typescript
// Use strict mode
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}

// No 'any' types
// BAD
function process(data: any) {}

// GOOD
function process(data: NormalizedTicker) {}

// Use interfaces for objects
interface Opportunity {
  id: string;
  type: string;
  netProfitBps: number;
}
```

### Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Files | kebab-case | `opportunity-detector.ts` |
| Classes | PascalCase | `OpportunityDetector` |
| Functions | camelCase | `detectOpportunities()` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Interfaces | PascalCase with I prefix | `IOpportunity` |
| Types | PascalCase | `OpportunityType` |
| Enums | PascalCase | `VenueType` |
| Private fields | camelCase with underscore | `_cache` |

### Code Style

- Use Prettier for formatting (run `pnpm format`)
- Use ESLint for linting (run `pnpm lint`)
- Maximum line length: 100 characters
- Use single quotes for strings
- Use template literals for string interpolation
- Use destructuring where appropriate

```typescript
// GOOD
const { venueId, pair, bid, ask } = ticker;

// BAD
const venueId = ticker.venueId;
const pair = ticker.pair;
const bid = ticker.bid;
const ask = ticker.ask;
```

### Error Handling

```typescript
// Use custom error classes
class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

// Always log errors with context
try {
  await riskyOperation();
} catch (error) {
  this.logger.error({ error, venueId, opportunityId }, 'Operation failed');
  throw new ServiceError('OPERATION_FAILED', 'Operation failed', 500, undefined, error);
}

// Never swallow errors
// BAD
try {
  await riskyOperation();
} catch (e) {
  // Ignore
}

// GOOD
try {
  await riskyOperation();
} catch (error) {
  this.logger.error({ error }, 'Operation failed');
  throw error;
}
```

### No Hardcoded Values

```typescript
// BAD
const timeout = 5000;
const url = 'https://api.binance.com';

// GOOD
const timeout = parseInt(process.env.REQUEST_TIMEOUT_MS ?? '5000', 10);
const url = this.config.exchanges.binance.restEndpoint;
```

---

## Testing Requirements

### Coverage Requirements

- **Overall**: ≥80%
- **Core engines** (arbitrage, risk, execution): ≥90%
- **Connectors**: ≥80%
- **API handlers**: ≥80%
- **Database repositories**: ≥85%

### Test Structure

```typescript
describe('OpportunityDetector', () => {
  let detector: OpportunityDetector;
  let mockSnapshot: MarketSnapshot;

  beforeEach(() => {
    detector = new OpportunityDetector();
    mockSnapshot = createMockSnapshot();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('detectCexCex', () => {
    it('detects opportunities when spread exceeds threshold', async () => {
      // Arrange
      detector.config.minProfitBps = 50;

      // Act
      const opportunities = await detector.detectCexCex(mockSnapshot);

      // Assert
      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].netProfitBps).toBeGreaterThanOrEqual(50);
    });

    it('ignores opportunities below minimum profit', async () => {
      // Arrange
      detector.config.minProfitBps = 10000; // Very high

      // Act
      const opportunities = await detector.detectCexCex(mockSnapshot);

      // Assert
      expect(opportunities).toHaveLength(0);
    });
  });
});
```

### Running Tests

```bash
# Unit tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Load tests
pnpm test:load
```

---

## Documentation

### Code Documentation

Every exported function, class, and interface must have JSDoc comments:

```typescript
/**
 * Calculates the net profit for an arbitrage opportunity.
 *
 * Formula:
 *   NetProfit = (SellPrice - BuyPrice) * Amount - Fees - Gas - Slippage
 *
 * @param opportunity - The opportunity to calculate profit for
 * @param fees - Fee schedule for both venues
 * @param slippage - Estimated slippage cost
 * @returns Net profit as BigNumber
 * @throws {ValidationError} If amounts don't match precision
 * @example
 * ```typescript
 * const profit = calculateNetProfit(
 *   opportunity,
 *   fees,
 *   slippage
 * );
 * ```
 */
function calculateNetProfit(
  opportunity: Opportunity,
  fees: FeeSchedule,
  slippage: SlippageEstimate
): BigNumber {
  // Implementation
}
```

### Specification Updates

If your change affects behavior documented in the specification:
1. Update the relevant `.md` file in `docs/`
2. Update cross-references
3. Update examples if necessary
4. Note changes in CHANGELOG.md

---

## AI Contributions

AI agents (Claude, Codex, Cursor, Copilot, etc.) must follow [23_AI_CONTRIBUTION_GUIDE.md](docs/23_AI_CONTRIBUTION_GUIDE.md).

**Summary:**
- Never weaken tests
- Never hardcode values
- Fix root causes
- Document assumptions
- Produce verification reports
- Write production-ready code

---

## Community

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General discussion and questions
- **Discord**: [discord.gg/arbitrage-pro](https://discord.gg/arbitrage-pro) — Real-time chat
- **Twitter**: [@arbitrage_pro](https://twitter.com/arbitrage_pro) — Updates and announcements

### Reporting Security Issues

**Do NOT report security vulnerabilities through public GitHub issues.**

Email: [security@arbitrage-pro.com](mailto:security@arbitrage-pro.com)

See [SECURITY.md](SECURITY.md) for details.

### Recognition

All contributors are recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project website (coming soon)

---

## Questions?

If you have questions, feel free to:
- Open a [GitHub Discussion](https://github.com/arbitrage-pro/core/discussions)
- Join our [Discord](https://discord.gg/arbitrage-pro)
- Email: [maintainers@arbitrage-pro.com](mailto:maintainers@arbitrage-pro.com)

---

## Engineering Notes

- This file is version-controlled alongside code
- Reviewed quarterly and updated as needed
- All contributors must read and follow these guidelines
- Deviations require maintainer approval