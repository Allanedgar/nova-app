# Deployment

**Document:** Engineering Standards
**Cross-References:** [06_DEPENDENCIES.md](06_DEPENDENCIES.md), [28_OBSERVABILITY.md](28_OBSERVABILITY.md), [04_TECH_STACK.md](04_TECH_STACK.md)

---

## 1. Overview

Production deployment specification for ARBITRAGE-PRO. Covers containerization, orchestration, CI/CD, and release management.

**Key Properties:**
- Docker — Multi-stage builds
- Kubernetes — Helm charts + Kustomize
- CI/CD — GitHub Actions
- Environments — Dev, staging, production
- Zero-downtime — Rolling updates

---

## 2. Architecture

```mermaid
flowchart LR
    A[GitHub] --> B[CI/CD]
    B --> C[Build Images]
    C --> D[Push Registry]
    D --> E[Deploy K8s]
    
    E --> F[Dev]
    E --> G[Staging]
    E --> H[Prod]
    
    I[Developer] --> A
    J[PR] --> B
```

---

## 3. Docker Configuration

### 3.1 API Dockerfile

```dockerfile
# apps/api/Dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@9.0.0
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Production stage
FROM node:20-alpine
WORKDIR /app

RUN npm install -g pnpm@9.0.0

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "dist/main"]
```

### 3.2 Web Dockerfile

```dockerfile
# apps/web/Dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@9.0.0
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
```

### 3.3 Mobile Dockerfile (Build only)

```dockerfile
# apps/mobile/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g eas-cli@latest
COPY package.json ./
RUN npm install

COPY . .
RUN eas build --platform all --non-interactive
```

---

## 4. Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - '4000:4000'
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/arbitrage
      - REDIS_URL=redis://redis:6379
      - SUPABASE_URL=http://supabase:8000
      - SUPABASE_SERVICE_ROLE_KEY=eyJ...
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./apps/api:/app/apps/api
      - ./packages:/app/packages

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:4000

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=arbitrage
      - POSTGRES_PASSWORD=password
    ports:
      - '5432:5432'
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5

  prometheus:
    image: prom/prometheus:latest
    ports:
      - '9090:9090'
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - '3001:3000'
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  postgres-data:
  redis-data:
  grafana-data:
```

---

## 5. Kubernetes Deployment

### 5.1 Namespace

```yaml
# kubernetes/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: arbitrage-pro
  labels:
    name: arbitrage-pro
```

### 5.2 API Deployment

```yaml
# kubernetes/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: arbitrage-pro
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: ghcr.io/arbitrage-pro/api:latest
          ports:
            - containerPort: 4000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: api-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: api-secrets
                  key: redis-url
          resources:
            requests:
              cpu: '500m'
              memory: '512Mi'
            limits:
              cpu: '1000m'
              memory: '1Gi'
          livenessProbe:
            httpGet:
              path: /health/live
              port: 4000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 4000
            initialDelaySeconds: 10
            periodSeconds: 5
          securityContext:
            runAsNonRoot: true
            readOnlyRootFilesystem: true
```

### 5.3 Service

```yaml
# kubernetes/api-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: arbitrage-pro
spec:
  selector:
    app: api
  ports:
    - port: 4000
      targetPort: 4000
  type: ClusterIP
```

### 5.4 Ingress

```yaml
# kubernetes/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: arbitrage-pro
  namespace: arbitrage-pro
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
    nginx.ingress.kubernetes.io/rate-limit: '100'
spec:
  tls:
    - hosts:
        - api.arbitrage-pro.com
      secretName: api-tls
  rules:
    - host: api.arbitrage-pro.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 4000
```

---

## 6. Helm Chart

### 6.1 Chart Structure

```
helm/arbitrage-pro/
├── Chart.yaml
├── values.yaml
├── values-prod.yaml
├── values-staging.yaml
├── templates/
│   ├── namespace.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   └── hpa.yaml
└── charts/
```

### 6.2 Chart Values

```yaml
# helm/arbitrage-pro/values.yaml
replicaCount: 3

image:
  repository: ghcr.io/arbitrage-pro/api
  tag: latest
  pullPolicy: Always

service:
  port: 4000
  type: ClusterIP

ingress:
  enabled: true
  host: api.arbitrage-pro.com
  tls: true

resources:
  requests:
    cpu: '500m'
    memory: '512Mi'
  limits:
    cpu: '1000m'
    memory: '1Gi'

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPU: 70
  targetMemory: 80

secrets:
  databaseUrl: ''
  redisUrl: ''
  supabaseUrl: ''
  supabaseKey: ''
```

---

## 7. CI/CD Pipeline

### 7.1 GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: docker/setup-buildx-action@v3
      
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/api/Dockerfile
          push: true
          tags: |
            ghcr.io/arbitrage-pro/api:${{ github.sha }}
            ghcr.io/arbitrage-pro/api:${{ github.ref_name }}
          cache-from: type=registry,ref=ghcr.io/arbitrage-pro/api:buildcache
          cache-to: type=registry,ref=ghcr.io/arbitrage-pro/api:buildcache,mode=max

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: azure/k8s-set-context@v4
        with:
          kubeconfig: ${{ secrets.STAGING_KUBECONFIG }}
      
      - run: |
          helm upgrade --install api ./helm/arbitrage-pro \
            --namespace arbitrage-pro \
            --values values.yaml \
            --values values-staging.yaml \
            --set image.tag=${{ github.sha }}

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: azure/k8s-set-context@v4
        with:
          kubeconfig: ${{ secrets.PROD_KUBECONFIG }}
      
      - run: |
          helm upgrade --install api ./helm/arbitrage-pro \
            --namespace arbitrage-pro \
            --values values.yaml \
            --values values-prod.yaml \
            --set image.tag=${{ github.sha }}
      
      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          channel-id: 'deployments'
          slack-message: |
            Production deployed: ${{ github.sha }}
            Author: ${{ github.actor }}
```

---

## 8. Release Process

### 8.1 Versioning

```bash
# Semantic versioning
v1.2.3
│ │ │
│ │ └── Patch: Bug fixes
│ └── Minor: New features (backward compatible)
└── Major: Breaking changes
```

### 8.2 Release Checklist

- [ ] All tests pass
- [ ] Security scan clean
- [ ] Migration reviewed
- [ ] Changelog updated
- [ ] Version bumped
- [ ] Tag created
- [ ] Deployed to staging
- [ ] QA signed off
- [ ] Deployed to production
- [ ] Monitoring verified

### 8.3 Rollback Procedure

```bash
# Rollback to previous version
helm rollback api ./helm/arbitrage-pro -n arbitrage-pro

# Or deploy specific version
helm upgrade api ./helm/arbitrage-pro \
  --namespace arbitrage-pro \
  --set image.tag=v1.2.2
```

---

## 9. Secrets Management

### 9.1 Kubernetes Secrets

```yaml
# kubernetes/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: api-secrets
  namespace: arbitrage-pro
type: Opaque
stringData:
  database-url: postgresql://user:pass@host:5432/arbitrage
  redis-url: redis://host:6379
  supabase-url: https://xxx.supabase.co
  supabase-key: eyJ...
  binance-api-key: xxx
  binance-secret: xxx
```

### 9.2 External Secrets Operator

```yaml
# kubernetes/external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: api-secrets
  namespace: arbitrage-pro
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: api-secrets
    creationPolicy: Owner
  data:
    - secretKey: database-url
      remoteRef:
        key: arbitrage-pro/prod/database
        property: url
```

---

## 10. Monitoring Integration

### 10.1 Prometheus ServiceMonitor

```yaml
# kubernetes/servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: api
  namespace: arbitrage-pro
spec:
  selector:
    matchLabels:
      app: api
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
```

---

## 11. Acceptance Criteria

- [ ] Docker images build successfully
- [ ] Helm chart deploys
- [ ] CI/CD pipeline works
- [ ] Secrets managed securely
- [ ] Health checks pass
- [ ] Auto-scaling works
- [ ] Rollback tested
- [ ] Zero-downtime deploys

## Engineering Notes

- Use multi-stage Docker builds
- Never commit secrets
- Scan images for vulnerabilities
- Test in staging before production
- Keep deployment manifests in Git
- Monitor every deployment