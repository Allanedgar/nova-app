**See also:** [16_API_SPECIFICATION.md](16_API_SPECIFICATION.md), [14_DATABASE_SCHEMA.md](14_DATABASE_SCHEMA.md), [15_FRONTEND_SPECIFICATION.md](15_FRONTEND_SPECIFICATION.md)
# Backend Specification

**Document:** Phase 4 — Web Dashboard v2
**Cross-References:** [15_FRONTEND_SPECIFICATION.md](15_FRONTEND_SPECIFICATION.md), [16_API_SPECIFICATION.md](16_API_SPECIFICATION.md)

---

## 1. Overview

NestJS 11 backend for ARBITRAGE-PRO. Handles API requests, WebSocket connections, background workers, and integration with external services.

**Key Properties:**
- Modular architecture with dependency injection
- Decorator-based routing and guards
- Background workers with BullMQ
- WebSocket gateway for real-time updates
- Type-safe with TypeScript

---

## 2. Architecture

### 2.1 Module Structure

```
apps/api/src/
├── main.ts                    # Bootstrap
├── app.module.ts              # Root module
├── common/
│   ├── guards/
│   │   ├── auth.guard.ts      # JWT validation
│   │   └── roles.guard.ts     # RBAC
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   └── transform.interceptor.ts
│   └── filters/
│       └── http-exception.filter.ts
├── auth/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   └── mfa.service.ts
├── market/
│   ├── market.controller.ts
│   ├── market.service.ts
│   ├── detector.worker.ts
│   └── schemas/
│       ├── opportunity.schema.ts
│       └── snapshot.schema.ts
├── opportunities/
│   ├── opportunities.controller.ts
│   ├── opportunities.service.ts
│   └── opportunities.module.ts
├── alerts/
│   ├── alerts.controller.ts
│   ├── alerts.service.ts
│   ├── alerts.evaluator.ts
│   └── alerts.dispatcher.ts
├── execution/
│   ├── execution.controller.ts
│   ├── execution.service.ts
│   ├── execution.worker.ts
│   ├── manual.executor.ts
│   ├── simulated.executor.ts
│   └── automated.executor.ts
├── workers/
│   ├── detector.worker.ts     # 5s cron
│   ├── alerts.worker.ts       # 10s cron
│   └── executor.worker.ts     # BullMQ queues
├── websocket/
│   ├── gateway.ts
│   └── handlers/
│       ├── opportunities.handler.ts
│       └── markets.handler.ts
├── connectors/
│   ├── connector-registry.ts
│   ├── binance/
│   ├── okx/
│   └── krakendex/
└── config/
    ├── database.config.ts
    ├── redis.config.ts
    └── supabase.config.ts
```

---

## 3. Core Modules

### 3.1 App Module

```typescript
// apps/api/src/app.module.ts
@Module({
  imports: [
    // Core
    ConfigModule,
    ScheduleModule.forRoot(),
    
    // Features
    AuthModule,
    MarketModule,
    OpportunitiesModule,
    AlertsModule,
    ExecutionModule,
    WebSocketModule,
    
    // Infrastructure
    ConnectorsModule,
    PersistenceModule,
    CacheModule,
    RiskModule,
    
    // Third-party
    BullModule.forRoot({
      redis: { host: 'localhost', port: 6379 }
    }),
    SupabaseModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
```

### 3.2 Market Module

```typescript
// apps/api/src/market/market.module.ts
@Module({
  imports: [
    BullModule.registerQueue({ name: 'detector' }),
    ConnectorsModule,
    PersistenceModule,
    RiskModule
  ],
  controllers: [MarketController],
  providers: [MarketService, DetectorWorker],
  exports: [MarketService]
})
export class MarketModule {}
```

### 3.3 Execution Module

```typescript
// apps/api/src/execution/execution.module.ts
@Module({
  imports: [
    BullModule.registerQueue({ name: 'manual' }),
    BullModule.registerQueue({ name: 'simulated' }),
    BullModule.registerQueue({ name: 'automated' }),
    PersistenceModule,
    RiskModule
  ],
  controllers: [ExecutionController],
  providers: [
    ExecutionService,
    ManualExecutor,
    SimulatedExecutor,
    AutomatedExecutor,
    SafetyChecker,
    ExecutorWorker
  ],
  exports: [ExecutionService]
})
export class ExecutionModule {}
```

---

## 4. Controllers

### 4.1 Market Controller

```typescript
// apps/api/src/market/market.controller.ts
@Controller('markets')
@UseGuards(AuthGuard)
export class MarketController {
  constructor(private marketService: MarketService) {}
  
  @Get('snapshots')
  async getSnapshots() {
    return this.marketService.getLatestSnapshots();
  }
  
  @Get('health')
  async getHealth() {
    return this.marketService.getHealth();
  }
}
```

### 4.2 Opportunities Controller

```typescript
// apps/api/src/opportunities/opportunities.controller.ts
@Controller('opportunities')
@UseGuards(AuthGuard)
export class OpportunitiesController {
  constructor(private opportunitiesService: OpportunitiesService) {}
  
  @Get()
  async getOpportunities(@Query() params: GetOpportunitiesParams) {
    return this.opportunitiesService.findMany(params);
  }
  
  @Get(':id')
  async getOpportunity(@Param('id') id: string) {
    return this.opportunitiesService.findOne(id);
  }
  
  @Post(':id/execute')
  @UseGuards(RolesGuard)
  @Roles('premium', 'admin')
  async execute(@Param('id') id: string, @Body() dto: ExecuteDto) {
    return this.opportunitiesService.execute(id, dto);
  }
}
```

### 4.3 Alerts Controller

```typescript
// apps/api/src/alerts/alerts.controller.ts
@Controller('alerts')
@UseGuards(AuthGuard)
export class AlertsController {
  constructor(private alertsService: AlertsService) {}
  
  @Get()
  async getAlerts(@Request() req) {
    return this.alertsService.findByUser(req.user.id);
  }
  
  @Post()
  async createAlert(@Request() req, @Body() dto: CreateAlertDto) {
    return this.alertsService.create(req.user.id, dto);
  }
  
  @Put(':id')
  async updateAlert(@Param('id') id: string, @Body() dto: UpdateAlertDto) {
    return this.alertsService.update(id, dto);
  }
  
  @Delete(':id')
  async deleteAlert(@Param('id') id: string) {
    return this.alertsService.delete(id);
  }
}
```

---

## 5. Services

### 5.1 Market Service

```typescript
// apps/api/src/market/market.service.ts
@Injectable()
export class MarketService {
  constructor(
    private connectorRegistry: ConnectorRegistry,
    private engine: ArbitrageEngine,
    private riskEngine: RiskEngine,
    private persistence: SupabasePersistence
  ) {}
  
  async getOpportunities(snapshots?: PriceSnapshot[]): Promise<ArbitrageOpportunity[]> {
    // 1. Fetch snapshots if not provided
    const snapshotList = snapshots ?? await this.fetchSnapshots();
    
    // 2. Detect opportunities
    const opportunities = await this.engine.detect(snapshotList);
    
    // 3. Score risk
    const scored = opportunities.map(opp => ({
      ...opp,
      riskScore: this.riskEngine.scoreRisk(snapshotList, opp).totalScore
    }));
    
    // 4. Filter by risk
    return scored.filter(opp => opp.riskScore >= 50);
  }
  
  private async fetchSnapshots(): Promise<PriceSnapshot[]> {
    const enabledConnectors = await this.getEnabledConnectors();
    const symbols = await this.getDiscoveredPairs();
    
    return this.connectorRegistry.loadMarketSnapshots(symbols, enabledConnectors);
  }
}
```

### 5.2 Execution Service

```typescript
// apps/api/src/execution/execution.service.ts
@Injectable()
export class ExecutionService {
  constructor(
    private router: ExecutorRouter,
    private persistence: SupabasePersistence,
    private auditLogger: AuditLogger
  ) {}
  
  async execute(
    opportunityId: string,
    user: User,
    dto: ExecuteDto
  ): Promise<ExecutionResult> {
    // 1. Get opportunity
    const opportunity = await this.persistence.getOpportunity(opportunityId);
    if (!opportunity) throw new NotFoundException();
    
    // 2. Get user risk tier
    const profile = await this.persistence.getProfile(user.id);
    const tier = profile.risk_tier;
    
    // 3. Route to executor
    const executor = this.router.forTier(tier);
    
    // 4. Execute
    const result = await executor.execute(opportunity, user, dto);
    
    // 5. Log
    await this.auditLogger.log({
      userId: user.id,
      type: AuditEventType.OPPORTUNITY_EXECUTED,
      metadata: { opportunityId, tier, result }
    });
    
    return result;
  }
}
```

---

## 6. Workers

### 6.1 Detector Worker

```typescript
// apps/api/src/workers/detector.worker.ts
@Cron('*/5 * * * * *')
@Injectable()
export class DetectorWorker {
  constructor(
    private connectorRegistry: ConnectorRegistry,
    private marketService: MarketService,
    private persistence: SupabasePersistence,
    private wsGateway: MarketsGateway
  ) {}
  
  async handle() {
    try {
      // 1. Fetch enabled connectors
      const enabled = await this.connectorRegistry.getEnabledConnectors();
      
      // 2. Get discovered pairs
      const symbols = await this.connectorRegistry.getDiscoveredPairs();
      
      // 3. Fetch snapshots
      const snapshots = await this.connectorRegistry.loadMarketSnapshots(symbols, enabled);
      
      // 4. Detect opportunities
      const opportunities = await this.marketService.getOpportunities(snapshots);
      
      // 5. Persist top 50
      if (opportunities.length > 0) {
        await this.persistence.upsertOpportunities(opportunities.slice(0, 50));
      }
      
      // 6. Broadcast
      opportunities.forEach(opp => {
        this.wsGateway.broadcastOpportunity(opp);
      });
      
    } catch (error) {
      logger.error({ error }, 'Detector cycle failed');
    }
  }
}
```

### 6.2 Alerts Worker

```typescript
// apps/api/src/workers/alerts.worker.ts
@Cron('*/10 * * * * *')
@Injectable()
export class AlertsWorker {
  constructor(
    private alertsService: AlertsService,
    private persistence: SupabasePersistence,
    private dispatcher: AlertDispatcher
  ) {}
  
  async handle() {
    // 1. Get enabled alert rules
    const rules = await this.alertsService.getEnabledRules();
    
    // 2. Get recent opportunities
    const opportunities = await this.persistence.getRecentOpportunities();
    
    // 3. Match opportunities to rules
    for (const rule of rules) {
      const matched = opportunities.filter(opp => this.matches(opp, rule));
      
      if (matched.length > 0) {
        // 4. Dispatch notifications
        await this.dispatcher.dispatch(rule, matched);
        
        // 5. Update last triggered
        await this.alertsService.updateLastTriggered(rule.id);
      }
    }
  }
  
  private matches(opp: ArbitrageOpportunity, rule: AlertRule): boolean {
    return (
      opp.pair === rule.pair &&
      opp.netProfitBps >= rule.minProfitBps &&
      (!rule.maxRiskScore || opp.riskScore <= rule.maxRiskScore)
    );
  }
}
```

### 6.3 Executor Worker

```typescript
// apps/api/src/workers/executor.worker.ts
@Processor('automated')
@Injectable()
export class ExecutorWorker {
  constructor(private executionService: ExecutionService) {}
  
  @Process('execute')
  async execute(job: Job<ExecutionJob>) {
    const { opportunityId, userId } = job.data;
    
    try {
      const result = await this.executionService.execute(opportunityId, userId, {
        notionalUsd: 100,
        type: 'automated'
      });
      
      await job.progress(100);
      return result;
    } catch (error) {
      await job.moveToFailed({ message: error.message });
      throw error;
    }
  }
}
```

---

## 7. WebSocket Gateway

### 7.1 Gateway Setup

```typescript
// apps/api/src/websocket/gateway.ts
@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket']
})
export class MarketsGateway implements OnGatewayConnection, OnGatewayDisconnection {
  @WebSocketServer()
  server: Server;
  
  private opportunitySubscribers = new Map<string, Set<WebSocket>>();
  private marketSubscribers = new Map<string, Set<WebSocket>>();
  
  handleConnection(client: WebSocket) {
    logger.info('Client connected', { id: client.id });
  }
  
  handleDisconnect(client: WebSocket) {
    // Remove from all subscriptions
    for (const [key, subscribers] of this.opportunitySubscribers) {
      subscribers.delete(client);
    }
  }
  
  @SubscribeMessage('subscribe:opportunities')
  async handleSubscribeOpportunities(
    @MessageBody() userId: string,
    @ConnectedSocket() client: WebSocket
  ) {
    const subscribers = this.opportunitySubscribers.get(userId) ?? new Set();
    subscribers.add(client);
    this.opportunitySubscribers.set(userId, subscribers);
    
    client.emit('subscribed', { channel: 'opportunities' });
  }
  
  @SubscribeMessage('subscribe:markets')
  async handleSubscribeMarkets(
    @MessageBody() symbol: string,
    @ConnectedSocket() client: WebSocket
  ) {
    const subscribers = this.marketSubscribers.get(symbol) ?? new Set();
    subscribers.add(client);
    this.marketSubscribers.set(symbol, subscribers);
    
    client.emit('subscribed', { channel: `markets:${symbol}` });
  }
  
  broadcastOpportunity(opportunity: ArbitrageOpportunity) {
    const subscribers = this.opportunitySubscribers.get(opportunity.userId);
    if (!subscribers) return;
    
    subscribers.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.emit('opportunity', {
          id: opportunity.id,
          pair: opportunity.pair,
          netProfitBps: opportunity.netProfitBps,
          riskScore: opportunity.riskScore
        });
      }
    });
  }
}
```

---

## 8. Middleware

### 8.1 Logging Middleware

```typescript
// apps/api/src/common/middleware/logging.middleware.ts
@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info({
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration
      });
    });
    
    next();
  }
}
```

### 8.2 Error Handling

```typescript
// apps/api/src/common/filters/http-exception.filter.ts
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    const status = exception.getStatus();
    const message = exception.message;
    
    response.status(status).json({
      error: {
        code: exception.name,
        message,
        timestamp: new Date().toISOString()
      }
    });
  }
}
```

---

## 9. Configuration

### 9.1 Environment Config

```typescript
// apps/api/src/config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT, 10) || 4000,
  database: {
    url: process.env.DATABASE_URL
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10)
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  },
  exchange: {
    binance: {
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_API_SECRET
    }
  }
});
```

---

## 10. Testing

### 10.1 Unit Tests

```typescript
// apps/api/src/market/market.service.spec.ts
describe('MarketService', () => {
  let service: MarketService;
  let mockConnector: jest.Mocked<Connector>;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [MarketService, {
        provide: ConnectorRegistry,
        useValue: { loadMarketSnapshots: jest.fn() }
      }]
    }).compile();
    
    service = module.get<MarketService>(MarketService);
  });
  
  it('detects opportunities', async () => {
    const snapshots = [createMockSnapshot()];
    const opps = await service.getOpportunities(snapshots);
    
    expect(opps).toBeInstanceOf(Array);
  });
});
```

### 10.2 Integration Tests

```typescript
// apps/api/test/integration/e2e-app.e2e-spec.ts
describe('E2E Application', () => {
  let app: INestApplication;
  let server: Server;
  
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    
    app = module.createNestApplication();
    await app.init();
    server = app.getHttpServer();
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  it('/opportunities (GET)', async () => {
    const response = await request(server)
      .get('/opportunities')
      .set('Authorization', `Bearer ${testToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.opportunities).toBeInstanceOf(Array);
  });
});
```

---

## 11. Performance

### 11.1 Targets

| Metric | Target |
|---|---|
| API response time | <200ms p95 |
| WebSocket latency | <50ms |
| Detector cycle | <5s |
| Memory usage | <512MB |
| CPU usage | <70% |

### 11.2 Optimization

- Connection pooling for database
- Redis caching for frequent queries
- Compression middleware (gzip)
- Rate limiting per user
- Circuit breakers for external APIs

---

## 12. Acceptance Criteria

- [ ] All endpoints implemented
- [ ] WebSocket functional
- [ ] Workers running on schedule
- [ ] Error handling comprehensive
- [ ] Logging structured
- [ ] Configuration externalized
- [ ] Tests passing (80% coverage)
- [ ] Performance targets met

## Engineering Notes

- Use dependency injection everywhere
- Keep controllers thin, services thick
- Workers are idempotent
- Graceful shutdown on SIGTERM
- Health checks for all dependencies