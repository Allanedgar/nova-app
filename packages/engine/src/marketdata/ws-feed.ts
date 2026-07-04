/**
 * WebSocket Feed Manager — manages real-time price feeds from CEX venues.
 * Uses global WebSocket (available in Node 21+ or via ws package).
 */
declare const WebSocket: {
  new(url: string): any;
  prototype: any;
};

export interface WsFeedConfig {
  venueId: string;
  wsUrl: string;
  reconnectDelayMs: number;
  maxReconnectAttempts: number;
}

export interface WsFeedHealth {
  connected: boolean;
  latencyMs: number;
  messagesPerSec: number;
  lastMessageAt: number;
  reconnectAttempts: number;
}

export interface PriceUpdate {
  venueId: string;
  symbol: string;
  bid: string;
  ask: string;
  timestamp: number;
}

export type PriceUpdateHandler = (update: PriceUpdate) => void;

export interface WsFeedManager {
  addFeed(config: WsFeedConfig): void;
  connectAll(): void;
  disconnectAll(): void;
  onUpdate(handler: PriceUpdateHandler): void;
  getHealth(): Map<string, WsFeedHealth>;
}

export class DefaultWsFeedManager implements WsFeedManager {
  private feeds: Map<string, WsFeed> = new Map();
  private handlers: Set<PriceUpdateHandler> = new Set();

  addFeed(config: WsFeedConfig): void {
    const feed = new WsFeed(config, (update) => {
      for (const handler of this.handlers) {
        try { handler(update); } catch { /* handler error */ }
      }
    });
    this.feeds.set(config.venueId, feed);
  }

  connectAll(): void {
    for (const feed of this.feeds.values()) {
      feed.connect();
    }
  }

  disconnectAll(): void {
    for (const feed of this.feeds.values()) {
      feed.disconnect();
    }
  }

  onUpdate(handler: PriceUpdateHandler): void {
    this.handlers.add(handler);
  }

  getHealth(): Map<string, WsFeedHealth> {
    const health = new Map<string, WsFeedHealth>();
    for (const [id, feed] of this.feeds) {
      health.set(id, feed.getHealth());
    }
    return health;
  }
}

class WsFeed {
  private config: WsFeedConfig;
  private handler: PriceUpdateHandler;
  private reconnectAttempts = 0;
  private messageCount = 0;
  private lastMessageAt = 0;
  private connected = false;
  private latencyMs = 0;
  private ws: any = null;

  constructor(config: WsFeedConfig, handler: PriceUpdateHandler) {
    this.config = config;
    this.handler = handler;
  }

  connect(): void {
    try {
      if (typeof WebSocket === 'undefined') return;
      this.ws = new WebSocket(this.config.wsUrl);
      this.ws.onopen = () => { this.connected = true; this.reconnectAttempts = 0; };
      this.ws.onmessage = (event: any) => {
        this.messageCount++;
        this.lastMessageAt = Date.now();
        this.latencyMs = Date.now();
        this.handleMessage(typeof event.data === 'string' ? event.data : event.data?.toString() ?? '');
      };
      this.ws.onclose = () => {
        this.connected = false;
        this.scheduleReconnect();
      };
      this.ws.onerror = () => { this.connected = false; };
    } catch { this.scheduleReconnect(); }
  }

  disconnect(): void {
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
    this.connected = false;
  }

  getHealth(): WsFeedHealth {
    return {
      connected: this.connected,
      latencyMs: this.latencyMs,
      messagesPerSec: this.messageCount / Math.max(1, (Date.now() - this.lastMessageAt) / 1000),
      lastMessageAt: this.lastMessageAt,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  private handleMessage(data: string): void {
    try {
      const parsed = JSON.parse(data);
      if (parsed.bid && parsed.ask && parsed.s) {
        this.handler({
          venueId: this.config.venueId,
          symbol: parsed.s,
          bid: parsed.bid,
          ask: parsed.ask,
          timestamp: Date.now(),
        });
      }
    } catch { /* parse error */ }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), this.config.reconnectDelayMs * this.reconnectAttempts);
  }
}