# Mobile Specification

**Document:** Phase 5 — Mobile + Alerts
**Cross-References:** [04_TECH_STACK.md](04_TECH_STACK.md), [15_FRONTEND_SPECIFICATION.md](15_FRONTEND_SPECIFICATION.md), [19_PUSH_NOTIFICATIONS.md](19_PUSH_NOTIFICATIONS.md)

---

## 1. Overview

Expo React Native mobile app for ARBITRAGE-PRO. Provides native iOS/Android experience with push notifications, biometric authentication, and real-time opportunity viewing.

**Key Properties:**
- Cross-platform (iOS + Android)
- Expo SDK 52 for simplified builds
- Expo Router for file-based navigation
- Secure storage for credentials
- Push notifications via Expo

---

## 2. Architecture

### 2.1 App Structure

```
apps/mobile/
├── app/
│   ├── (auth)/
│   │   └── login.tsx
│   ├── (tabs)/
│   │   ├── index.tsx              # Home
│   │   ├── opportunities.tsx      # Opportunities list
│   │   ├── watchlist.tsx          # Saved opportunities
│   │   └── settings/
│   │       ├── index.tsx          # Settings main
│   │       ├── alerts.tsx         # Alert rules
│   │       ├── notifications.tsx  # Notification diagnostics
│   │       └── security.tsx       # Biometrics
│   └── opportunities/
│       └── [id].tsx               # Opportunity detail
├── src/
│   ├── auth/
│   │   ├── login-screen.tsx
│   │   ├── auth-context.tsx
│   │   └── biometric-auth.ts
│   ├── components/
│   │   ├── opportunity-card.tsx
│   │   ├── alert-rule-card.tsx
│   │   ├── profit-chart.tsx
│   │   └── settings-item.tsx
│   ├── hooks/
│   │   ├── use-realtime-opportunities.ts
│   │   ├── use-alerts.ts
│   │   └── use-push-notifications.ts
│   ├── services/
│   │   ├── supabase.ts
│   │   ├── api.ts
│   │   └── notifications.ts
│   └── utils/
│       ├── secure-storage.ts
│       └── format.ts
├── package.json
├── app.json
└── tsconfig.json
```

---

## 3. Tech Stack

- **Framework:** Expo SDK 52
- **Language:** TypeScript
- **Navigation:** Expo Router (file-based)
- **UI:** React Native Paper + Custom components
- **State:** TanStack Query + Context
- **Auth:** Supabase Auth + Expo Local Authentication
- **Storage:** Expo Secure Store
- **Notifications:** Expo Notifications
- **Charts:** react-native-chart-kit

---

## 4. Screens

### 4.1 Login Screen

```tsx
// apps/mobile/app/(auth)/login.tsx
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  
  const handleBiometricLogin = async () => {
    const credential = await authenticateAsync();
    if (credential.success) {
      // Retrieve session from secure storage
      const session = await getSession();
      signIn(session);
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ARBITRAGE-PRO</Text>
      
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <Button title="Login" onPress={() => signIn(email, password)} />
      
      <Button title="Login with Biometrics" onPress={handleBiometricLogin} />
    </View>
  );
}
```

### 4.2 Home Screen

```tsx
// apps/mobile/app/(tabs)/index.tsx
export default function HomeScreen() {
  const { user } = useAuth();
  const { data: opportunities } = useRealtimeOpportunities();
  
  return (
    <ScrollView>
      <Text style={styles.greeting}>Hello, {user.email}</Text>
      
      <View style={styles.stats}>
        <StatCard title="Active Opportunities" value={opportunities.length} />
        <StatCard title="Watchlist" value={watchlist.length} />
        <StatCard title="Alerts" value={alerts.length} />
      </View>
      
      <Text style={styles.sectionTitle}>Recent Opportunities</Text>
      <FlatList
        data={opportunities.slice(0, 10)}
        renderItem={({ item }) => <OpportunityCard opportunity={item} />}
      />
    </ScrollView>
  );
}
```

### 4.3 Opportunities Screen

```tsx
// apps/mobile/app/(tabs)/opportunities.tsx
export default function OpportunitiesScreen() {
  const { data: opportunities, isLoading } = useOpportunities();
  
  return (
    <View>
      <FilterBar onFilter={handleFilter} />
      
      {isLoading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={opportunities}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <OpportunityCard
              opportunity={item}
              onPress={() => router.push(`/opportunities/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}
```

### 4.4 Opportunity Detail

```tsx
// apps/mobile/app/opportunities/[id].tsx
export default function OpportunityDetail({ params }) {
  const { id } = params;
  const { data: opportunity } = useOpportunity(id);
  
  if (!opportunity) return <Loading />;
  
  return (
    <ScrollView>
      <Card>
        <Card.Title title={opportunity.pair} />
        <Card.Content>
          <ProfitBadge profit={opportunity.netProfitBps} />
          
          <Row label="Buy" value={`${opportunity.sourceExchange} @ ${opportunity.buyPrice}`} />
          <Row label="Sell" value={`${opportunity.targetExchange} @ ${opportunity.sellPrice}`} />
          <Row label="Risk" value={`${opportunity.riskScore}/100`} />
          <Row label="Liquidity" value={`$${opportunity.liquidityUsd}`} />
        </Card.Content>
      </Card>
      
      <Button title="Execute Trade" onPress={handleExecute} />
    </ScrollView>
  );
}
```

---

## 5. Components

### 5.1 Opportunity Card

```tsx
// src/components/opportunity-card.tsx
interface OpportunityCardProps {
  opportunity: ArbitrageOpportunity;
  onPress?: () => void;
}

export function OpportunityCard({ opportunity, onPress }: OpportunityCardProps) {
  const profitColor = opportunity.netProfitBps > 100 ? 'green' : 'orange';
  
  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content>
        <View style={styles.header}>
          <Text style={styles.pair}>{opportunity.pair}</Text>
          <Badge color={profitColor}>+{opportunity.netProfitBps.toFixed(2)} bps</Badge>
        </View>
        
        <View style={styles.details}>
          <Text>Buy: {opportunity.sourceExchange}</Text>
          <Text>Sell: {opportunity.targetExchange}</Text>
          <Text>Risk: {opportunity.riskScore}/100</Text>
        </View>
        
        <ProgressBar progress={opportunity.confidenceScore * 100} />
      </Card.Content>
    </Card>
  );
}
```

### 5.2 Alert Rule Card

```tsx
// src/components/alert-rule-card.tsx
export function AlertRuleCard({ rule, onToggle, onDelete }) {
  return (
    <List.Item
      title={rule.name}
      description={`Min: ${rule.minProfitBps} bps`}
      right={() => (
        <Switch value={rule.enabled} onValueChange={onToggle} />
      )}
      onLongPress={onDelete}
    />
  );
}
```

---

## 6. Hooks

### 6.1 useRealtimeOpportunities

```tsx
// src/hooks/use-realtime-opportunities.ts
export function useRealtimeOpportunities() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const channel = supabase
      .channel('mobile-opportunities')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'opportunities'
      }, (payload) => {
        setOpportunities(prev => [payload.new, ...prev]);
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  
  return opportunities;
}
```

### 6.2 usePushNotifications

```tsx
// src/hooks/use-push-notifications.ts
export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState('');
  
  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      setExpoPushToken(token);
    });
  }, []);
  
  return { expoPushToken };
}
```

---

## 7. Navigation

### 7.1 Tab Structure

```tsx
// app/(tabs)/_layout.tsx
export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: 'blue' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Icon name="home" color={color} />
        }}
      />
      <Tabs.Screen
        name="opportunities"
        options={{
          title: 'Opportunities',
          tabBarIcon: ({ color }) => <Icon name="trending-up" color={color} />
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          tabBarIcon: ({ color }) => <Icon name="star" color={color} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Icon name="settings" color={color} />
        }}
      />
    </Tabs>
  );
}
```

---

## 8. Styling

### 8.1 Theme

```tsx
// src/theme.ts
export const theme = {
  colors: {
    primary: '#2563eb',
    secondary: '#7c3aed',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    background: '#f3f4f6',
    surface: '#ffffff'
  },
  fonts: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    bold: 'Inter-Bold'
  }
};
```

---

## 9. Platform Specific

### 9.1 iOS

- Face ID / Touch ID authentication
- Live Activities for opportunity updates
- Haptic feedback on trade execution
- Widget for watchlist

### 9.2 Android

- Fingerprint authentication
- Notification Channels
- App Widget for watchlist
- BiometricPrompt API

---

## 10. Performance

### 10.1 Targets

| Metric | Target |
|---|---|
| App launch | <2s |
| Screen transition | <300ms |
| List scroll | 60fps |
| Memory usage | <200MB |
| APK/IPA size | <50MB |

### 10.2 Optimization

- Hermes engine enabled
- Image optimization (caching, resizing)
- List virtualization (FlatList)
- Memoization of expensive components
- Lazy loading of screens

---

## 11. Testing

### 11.1 Unit Tests

```tsx
describe('OpportunityCard', () => {
  it('displays profit', () => {
    const opp = createMockOpportunity({ netProfitBps: 75.5 });
    render(<OpportunityCard opportunity={opp} />);
    
    expect(screen.getByText('+75.50 bps')).toBeTruthy();
  });
});
```

### 11.2 Integration Tests

```tsx
describe('Login Flow', () => {
  it('logs in successfully', async () => {
    render(<LoginScreen />);
    
    await userEvent.type(screen.getByPlaceholderText('Email'), 'user@example.com');
    await userEvent.type(screen.getByPlaceholderText('Password'), 'password');
    await userEvent.press(screen.getByText('Login'));
    
    expect(await screen.findByText('Home')).toBeTruthy();
  });
});
```

---

## 12. Acceptance Criteria

- [ ] Login flow works (email + biometrics)
- [ ] Opportunities list displays
- [ ] Real-time updates work
- [ ] Alert CRUD functional
- [ ] Push notifications receive
- [ ] Settings screen functional
- [ ] Responsive on phone + tablet
- [ ] Tests pass (70% coverage)

## Engineering Notes

- Use Expo for simplified CI/CD
- Biometrics required for production
- Push notifications need APNs + FCM setup
- Test on real devices, not just simulators
- Hermes enabled by default