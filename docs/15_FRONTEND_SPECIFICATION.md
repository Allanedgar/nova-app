**See also:** [16_API_SPECIFICATION.md](16_API_SPECIFICATION.md), [17_BACKEND_SPECIFICATION.md](17_BACKEND_SPECIFICATION.md), [18_MOBILE_SPECIFICATION.md](18_MOBILE_SPECIFICATION.md)
# Frontend Specification

**Document:** Phase 4 — Web Dashboard v2
**Cross-References:** [04_TECH_STACK.md](04_TECH_STACK.md), [05_MONOREPO_STRUCTURE.md](05_MONOREPO_STRUCTURE.md), [16_API_SPECIFICATION.md](16_API_SPECIFICATION.md)

---

## 1. Overview

Next.js 15 web dashboard for ARBITRAGE-PRO. Provides real-time opportunity viewing, alert management, and execution controls.

**Key Properties:**
- React 19 with Server Components
- TanStack Query for data fetching
- Supabase Realtime for live updates
- Tailwind CSS for styling
- Type-safe with TypeScript

---

## 2. Architecture

### 2.1 App Structure

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── callback/route.ts
│   ├── opportunities/
│   │   └── [id]/page.tsx
│   ├── alerts/page.tsx
│   ├── watchlist/page.tsx
│   ├── settings/page.tsx
│   └── page.tsx
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── Table.tsx
│   ├── opportunities/
│   │   ├── OpportunityList.tsx
│   │   ├── OpportunityCard.tsx
│   │   └── OpportunityDetail.tsx
│   ├── alerts/
│   │   ├── AlertList.tsx
│   │   ├── AlertForm.tsx
│   │   └── AlertRuleCard.tsx
│   └── layout/
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── Footer.tsx
├── lib/
│   ├── supabase.ts
│   ├── api.ts
│   └── utils.ts
├── hooks/
│   ├── useRealtimeOpportunities.ts
│   ├── useAlerts.ts
│   └── useAuth.ts
└── package.json
```

---

## 3. Tech Stack

- **Framework:** Next.js 15 (App Router)
- **UI:** React 19 + Tailwind CSS 3
- **State:** TanStack Query v5
- **Auth:** Supabase Auth
- **Realtime:** Supabase Realtime
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod

---

## 4. Pages

### 4.1 Dashboard (page.tsx)

```tsx
// apps/web/app/page.tsx
export default async function DashboardPage() {
  const supabase = createServer();
  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('*')
    .order('detected_at', { ascending: false })
    .limit(50);
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Arbitrage Opportunities</h1>
      <OpportunityList opportunities={opportunities} />
    </div>
  );
}
```

### 4.2 Opportunity Detail

```tsx
// apps/web/app/opportunities/[id]/page.tsx
export default async function OpportunityPage({ params }) {
  const { id } = params;
  const supabase = createServer();
  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', id)
    .single();
  
  return (
    <div className="container mx-auto p-4">
      <OpportunityDetail opportunity={opportunity} />
    </div>
  );
}
```

### 4.3 Alerts

```tsx
// apps/web/app/alerts/page.tsx
'use client';
export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Alert Rules</h1>
      <AlertList alerts={alerts} />
      <AlertForm onSubmit={createAlert} />
    </div>
  );
}
```

---

## 5. Components

### 5.1 Opportunity Card

```tsx
// apps/web/components/opportunities/OpportunityCard.tsx
interface OpportunityCardProps {
  opportunity: ArbitrageOpportunity;
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between">
          <span className="font-bold">{opportunity.pair}</span>
          <span className="text-green-600">+{opportunity.netProfitBps.toFixed(2)} bps</span>
        </div>
      </CardHeader>
      <CardBody>
        <p>Buy: {opportunity.sourceExchange} @ {opportunity.buyPrice}</p>
        <p>Sell: {opportunity.targetExchange} @ {opportunity.sellPrice}</p>
        <p>Risk: {opportunity.riskScore}/100</p>
      </CardBody>
    </Card>
  );
}
```

### 5.2 Alert Form

```tsx
// apps/web/components/alerts/AlertForm.tsx
export function AlertForm({ onSubmit }) {
  const [pair, setPair] = useState('');
  const [minProfit, setMinProfit] = useState(50);
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input label="Pair" value={pair} onChange={e => setPair(e.target.value)} />
      <Input label="Min Profit (bps)" type="number" value={minProfit} onChange={e => setMinProfit(Number(e.target.value))} />
      <Button type="submit">Create Alert</Button>
    </form>
  );
}
```

---

## 6. Hooks

### 6.1 useRealtimeOpportunities

```tsx
// apps/web/hooks/useRealtimeOpportunities.ts
export function useRealtimeOpportunities(userId: string) {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const channel = supabase
      .channel(`opportunities:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'opportunities',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        setOpportunities(prev => [payload.new as ArbitrageOpportunity, ...prev]);
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [userId]);
  
  return opportunities;
}
```

### 6.2 useAuth

```tsx
// apps/web/hooks/useAuth.ts
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  return { user, loading };
}
```

---

## 7. Styling

### 7.1 Tailwind Config

```javascript
// apps/web/tailwind.config.js
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        secondary: '#7c3aed',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444'
      }
    }
  }
};
```

### 7.2 Global CSS

```css
/* apps/web/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-gray-50 text-gray-900;
  }
}

@layer components {
  .btn-primary {
    @apply bg-primary text-white px-4 py-2 rounded hover:bg-blue-600;
  }
}
```

---

## 8. API Client

```typescript
// apps/web/lib/api.ts
export const api = {
  getOpportunities: async (userId: string) => {
    const res = await fetch(`/api/opportunities?userId=${userId}`);
    return res.json();
  },
  
  createAlert: async (rule: CreateAlertRule) => {
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
    return res.json();
  },
  
  executeOpportunity: async (opportunityId: string) => {
    const res = await fetch(`/api/execute/${opportunityId}`, {
      method: 'POST'
    });
    return res.json();
  }
};
```

---

## 9. Responsive Design

### 9.1 Breakpoints

| Breakpoint | Width | Target |
|---|---|---|
| sm | 640px | Mobile |
| md | 768px | Tablet |
| lg | 1024px | Desktop |
| xl | 1280px | Large desktop |

### 9.2 Layout

```tsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <OpportunityCard />
  <OpportunityCard />
  <OpportunityCard />
</div>
```

---

## 10. Performance

### 10.1 Optimization

- **Server Components:** Default to server components
- **Image Optimization:** Next.js Image component
- **Code Splitting:** Dynamic imports for heavy components
- **Caching:** TanStack Query with 5s stale time
- **Prefetching:** Prefetch on hover

### 10.2 Metrics

| Metric | Target |
|---|---|
| First Contentful Paint | <1s |
| Largest Contentful Paint | <2s |
| Cumulative Layout Shift | <0.1 |
| First Input Delay | <100ms |

---

## 11. Acceptance Criteria

- [ ] Dashboard loads in <2s
- [ ] Opportunities update in real-time
- [ ] Alert CRUD functional
- [ ] Auth flow works
- [ ] Responsive on mobile
- [ ] Type-safe throughout
- [ ] Tests pass (80% coverage)

## Engineering Notes

- Use Server Components by default
- Client Components only when needed (interactivity)
- Supabase client split for server/client
- Realtime subscriptions cleaned up on unmount