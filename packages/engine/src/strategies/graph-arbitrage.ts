/**
 * Graph Arbitrage Strategy
 *
 * Models exchange rates as a weighted directed graph.
 * Uses Bellman-Ford algorithm to detect negative cycles (arbitrage).
 * Finds ANY profitable cycle — not just triangles.
 *
 * Theory:
 *   - Nodes = assets (BTC, ETH, SOL, USDT, ...)
 *   - Edges = exchange rates (rate = price of A in B)
 *   - Weight = -ln(rate)
 *   - Product of rates > 1 → sum of weights < 0 → negative cycle → arbitrage
 */
import type { ArbitrageStrategy } from './interface.js';
import type { NormalizedSnapshot, NormalizedPair } from '../types/snapshot.js';
import type {
  OpportunityCandidate, ScoredOpportunity, ValidationResult,
  OpportunityLeg, OpportunityKind,
} from '../types/opportunity.js';

interface GraphEdge {
  from: string;
  to: string;
  rate: number;
  venueId: string;
  pair: NormalizedPair;
}

interface GraphCycle {
  nodes: string[];
  edges: GraphEdge[];
  product: number;
  profitPct: number;
}

export class GraphArbitrageStrategy implements ArbitrageStrategy {
  readonly id = 'graph-arbitrage';
  readonly kind: OpportunityKind = 'graph';
  readonly version = '1.0.0';
  readonly displayName = 'Graph Arbitrage (Bellman-Ford)';

  private minProfitPct = 0.05;
  private maxCycleLength = 6;
  private maxSpreadAgeMs = 10000;

  async detect(snapshots: NormalizedSnapshot[]): Promise<OpportunityCandidate[]> {
    const candidates: OpportunityCandidate[] = [];

    const graph = this.buildGraph(snapshots);
    if (graph.size < 3) return candidates;

    const cycles = this.findArbitrageCycles(graph, this.minProfitPct);

    for (const cycle of cycles) {
      if (cycle.nodes.length > this.maxCycleLength) continue;

      const legs: OpportunityLeg[] = cycle.edges.map((e, i) => ({
        venueId: e.venueId,
        venueKind: 'cex',
        action: i === 0 ? 'buy' : 'sell',
        asset: `${e.from}${e.to}`,
        amount: '0',
        expectedPrice: e.rate.toFixed(6),
      }));

      candidates.push({
        id: `graph-${cycle.nodes.join('-')}-${Date.now()}`,
        strategyId: this.id,
        kind: this.kind,
        detectedAt: Date.now(),
        legs,
        grossProfitPct: Math.round(cycle.profitPct * 10000) / 10000,
        estimatedFeesPct: Math.round(cycle.edges.length * 0.10),
        netProfitPct: Math.round((cycle.profitPct - cycle.edges.length * 0.10) * 10000) / 10000,
      });
    }

    return candidates;
  }

  async score(candidate: OpportunityCandidate, snapshots: NormalizedSnapshot[]): Promise<ScoredOpportunity> {
    const freshness = Math.min(100, Math.max(0, 100 - (Date.now() - candidate.detectedAt) / 50));
    const cycleLen = candidate.legs.length;
    const complexity = Math.max(0, 100 - cycleLen * 15);
    const spread = 60;
    const venueReliability = 70;

    const confidenceScore = Math.round(
      freshness * 0.25 + complexity * 0.25 + spread * 0.25 + venueReliability * 0.25
    );

    const executionProbability = Math.max(0.1, 0.8 - cycleLen * 0.1);
    const riskScore = 100 - confidenceScore;
    const rankingScore =
      candidate.netProfitPct *
      (confidenceScore / 100) *
      executionProbability *
      (1 - riskScore / 100);

    return {
      ...candidate,
      confidenceScore,
      riskScore,
      rankingScore,
      executionProbability,
      expectedSlippage: 0.10 * cycleLen,
      expectedLatencyMs: 500 * cycleLen,
      expiresAt: candidate.detectedAt + 3000,
    };
  }

  async validate(opportunity: ScoredOpportunity): Promise<ValidationResult> {
    if (Date.now() - opportunity.detectedAt > this.maxSpreadAgeMs) {
      return { valid: false, reasons: ['Opportunity expired'], expectedFillPct: 0 };
    }
    return { valid: true, reasons: [], expectedFillPct: Math.max(0.1, 0.7 - opportunity.legs.length * 0.1) };
  }

  private buildGraph(snapshots: NormalizedSnapshot[]): Map<string, GraphEdge[]> {
    const graph = new Map<string, GraphEdge[]>();

    for (const snap of snapshots) {
      for (const pair of snap.pairs) {
        const base = pair.baseAsset.toUpperCase();
        const quote = pair.quoteAsset.toUpperCase();
        const bid = parseFloat(pair.bid);
        const ask = parseFloat(pair.ask);

        if (bid <= 0 || ask <= 0) continue;

        const forwardRate = bid;
        if (!graph.has(base)) graph.set(base, []);
        graph.get(base)!.push({ from: base, to: quote, rate: forwardRate, venueId: snap.venueId, pair });

        const reverseRate = 1 / ask;
        if (!graph.has(quote)) graph.set(quote, []);
        graph.get(quote)!.push({ from: quote, to: base, rate: reverseRate, venueId: snap.venueId, pair });
      }
    }

    return graph;
  }

  private findArbitrageCycles(
    graph: Map<string, GraphEdge[]>,
    minProfitPct: number
  ): GraphCycle[] {
    const nodes: string[] = Array.from(graph.keys());
    const n = nodes.length;
    const nodeIndex = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      nodeIndex.set(nodes[i]!, i);
    }

    const dist: number[] = new Array(n).fill(Infinity);
    const pred: (GraphEdge | null)[] = new Array(n).fill(null);

    const cycles: GraphCycle[] = [];
    const seen = new Set<string>();

    for (let startIdx = 0; startIdx < n; startIdx++) {
      dist.fill(Infinity);
      pred.fill(null);
      dist[startIdx] = 0;

      for (let i = 0; i < n - 1; i++) {
        for (let u = 0; u < n; u++) {
          if (dist[u] === Infinity) continue;
          const nodeU = nodes[u]!;
          const edges = graph.get(nodeU) ?? [];
          for (const edge of edges) {
            const vIdx = nodeIndex.get(edge.to);
            if (vIdx === undefined) continue;
            const weight = -Math.log(edge.rate);
            const distU = dist[u]!;
            const distV = dist[vIdx]!;
            if (distU + weight < distV) {
              dist[vIdx] = distU + weight;
              pred[vIdx] = edge;
            }
          }
        }
      }

      for (let u = 0; u < n; u++) {
        if (dist[u] === Infinity) continue;
        const nodeU = nodes[u]!;
        const edges = graph.get(nodeU) ?? [];
        for (const edge of edges) {
          const vIdx = nodeIndex.get(edge.to);
          if (vIdx === undefined) continue;
          const weight = -Math.log(edge.rate);
          const distU = dist[u]!;
          const distV = dist[vIdx]!;
          if (distU + weight < distV) {
            const cycle = this.extractCycle(pred, nodeIndex, vIdx, nodes);
            if (cycle && cycle.profitPct > minProfitPct) {
              const key = cycle.nodes.join('→');
              if (!seen.has(key)) {
                seen.add(key);
                cycles.push(cycle);
              }
            }
          }
        }
      }
    }

    cycles.sort((a, b) => b.profitPct - a.profitPct);
    return cycles.slice(0, 20);
  }

  private extractCycle(
    pred: (GraphEdge | null)[],
    nodeIndex: Map<string, number>,
    startNode: number,
    nodes: string[]
  ): GraphCycle | null {
    const visited = new Set<number>();
    let current = startNode;
    const rawNodes: number[] = [];
    const rawEdges: GraphEdge[] = [];

    while (!visited.has(current)) {
      if (current < 0 || current >= nodes.length) return null;
      visited.add(current);
      rawNodes.push(current);
      const edge = pred[current]!;
      if (!edge) return null;
      rawEdges.push(edge);
      const fromIdx = nodeIndex.get(edge.from);
      if (fromIdx === undefined) return null;
      current = fromIdx;
    }

    const cycleStart = rawNodes.indexOf(current);
    if (cycleStart < 0) return null;
    const cycleIndices = rawNodes.slice(cycleStart);
    if (cycleIndices.length < 3) return null;

    const trimmedNodes = cycleIndices.map(i => nodes[i]!).filter((n): n is string => Boolean(n));
    if (trimmedNodes.length < 3) return null;
    const trimmedEdges = rawEdges.slice(cycleStart);

    let product = 1;
    for (const edge of trimmedEdges) {
      product *= edge.rate;
    }

    return {
      nodes: trimmedNodes,
      edges: trimmedEdges,
      product,
      profitPct: (product - 1) * 100,
    };
  }
}