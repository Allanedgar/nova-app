import './styles/design-system.css';
import './styles/main.css';

interface OpportunitySummary {
  readonly id: string;
  readonly symbol: string;
  readonly route: string;
  readonly netProfitBps: number;
  readonly netProfitUsd: number;
  readonly confidenceScore: number;
  readonly riskScore?: number;
  readonly status: string;
}

interface OpportunitiesResponse {
  readonly opportunities: readonly OpportunitySummary[];
  readonly count: number;
  readonly checkedAt: string;
}

interface AssetOpportunityRow {
  readonly index: number;
  readonly baseAsset: string;
  readonly buyHereName: string;
  readonly buyHerePrice: number;
  readonly sellHereName: string;
  readonly sellHerePrice: number;
  readonly arbitrage: number;
  readonly grossSpreadBps: number;
  readonly estimatedFeeBps: number;
  readonly netSpreadBps: number;
  readonly routeType: string;
  readonly buyQuoteAsset: string;
  readonly sellQuoteAsset: string;
}

interface OpportunityTableResponse {
  readonly rows: readonly AssetOpportunityRow[];
  readonly count: number;
  readonly checkedAt: string;
}

const fallbackOpportunities: readonly OpportunitySummary[] = [
  {
    id: 'bootstrap-btc-usdt',
    symbol: 'BTC/USDT',
    route: 'Binance -> OKX',
    netProfitBps: 0,
    netProfitUsd: 0,
    confidenceScore: 0,
    status: 'waiting for live API',
  },
  {
    id: 'bootstrap-eth-usdt',
    symbol: 'ETH/USDT',
    route: 'CEX -> DEX',
    netProfitBps: 0,
    netProfitUsd: 0,
    confidenceScore: 0,
    status: 'pipeline pending',
  },
];

const fallbackRows: readonly AssetOpportunityRow[] = [
  {
    index: 0,
    baseAsset: 'BTC',
    buyHereName: 'Waiting',
    buyHerePrice: 0,
    sellHereName: 'Live API',
    sellHerePrice: 0,
    arbitrage: 0,
    grossSpreadBps: 0,
    estimatedFeeBps: 0,
    netSpreadBps: 0,
    routeType: 'cex-cex',
    buyQuoteAsset: 'USDT',
    sellQuoteAsset: 'USDT',
  },
];

const root = document.getElementById('root');

const money = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 2,
  style: 'currency',
});

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function fetchOpportunities(): Promise<readonly OpportunitySummary[]> {
  const baseUrl = import.meta.env.VITE_NOVA_API_URL;
  if (!baseUrl) return fallbackOpportunities;

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/opportunities`);
  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const payload = await response.json() as OpportunitiesResponse;
  return payload.opportunities.length > 0 ? payload.opportunities : fallbackOpportunities;
}

async function fetchOpportunityRows(): Promise<readonly AssetOpportunityRow[]> {
  const baseUrl = import.meta.env.VITE_NOVA_API_URL;
  if (!baseUrl) return fallbackRows;

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/opportunities/table`);
  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const payload = await response.json() as OpportunityTableResponse;
  return payload.rows.length > 0 ? payload.rows : fallbackRows;
}

function formatPrice(value: number): string {
  if (value === 0) return '-';
  if (value < 1) return value.toFixed(6);
  if (value < 100) return value.toFixed(4);
  return value.toFixed(2);
}

function renderOpportunityTable(rows: readonly AssetOpportunityRow[]): string {
  return `
    <div class="table-wrap">
      <table class="opportunity-table">
        <thead>
          <tr>
            <th>(index)</th>
            <th>baseAsset</th>
            <th>route</th>
            <th>buyHereName</th>
            <th>buyHerePrice</th>
            <th>sellHereName</th>
            <th>sellHerePrice</th>
            <th>arbitrage</th>
            <th>feesBps</th>
            <th>netBps</th>
            <th>status</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${row.index}</td>
              <td class="asset">'${escapeHtml(row.baseAsset)}'</td>
              <td class="route">${escapeHtml(row.routeType)}</td>
              <td class="venue">'${escapeHtml(row.buyHereName)}'</td>
              <td class="price">${formatPrice(row.buyHerePrice)}</td>
              <td class="venue">'${escapeHtml(row.sellHereName)}'</td>
              <td class="price">${formatPrice(row.sellHerePrice)}</td>
              <td class="arb">${row.arbitrage.toFixed(8)}</td>
              <td class="price">${row.estimatedFeeBps.toFixed(2)}</td>
              <td class="${row.netSpreadBps > 0 ? 'net-positive' : 'net-negative'}">${row.netSpreadBps.toFixed(2)}</td>
              <td><span class="status-tag ${row.netSpreadBps > 0 ? 'status-live' : 'status-watch'}">${row.netSpreadBps > 0 ? 'fee-positive' : 'watch'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderOpportunity(item: OpportunitySummary): string {
  const profit = item.netProfitUsd > 0
    ? `${money.format(item.netProfitUsd)} / ${item.netProfitBps.toFixed(1)} bps`
    : item.status;
  const risk = item.riskScore === undefined ? 'N/A' : item.riskScore.toFixed(0);
  const confidence = `${Math.round(item.confidenceScore * 100)}%`;

  return `
    <article class="opportunity-row">
      <div>
        <strong>${escapeHtml(item.symbol)}</strong>
        <span>${escapeHtml(item.route)}</span>
      </div>
      <div>
        <span>${escapeHtml(profit)}</span>
        <small>Risk ${escapeHtml(risk)} · Confidence ${escapeHtml(confidence)}</small>
      </div>
    </article>
  `;
}

function renderShell(
  opportunities: readonly OpportunitySummary[],
  rows: readonly AssetOpportunityRow[],
  status: string,
): void {
  if (!root) return;

  root.innerHTML = `
    <main class="app-shell">
      <section class="hero">
        <div>
          <p class="eyebrow">ARBITRAGE-PRO</p>
          <h1>Mobile opportunity console</h1>
          <p class="lede">${escapeHtml(status)}</p>
        </div>
        <div class="status-pill">${opportunities.length} tracked</div>
      </section>
      <section class="toolbar">
        <button type="button">Opportunities</button>
        <button type="button">Connectors</button>
        <button type="button">Alerts</button>
      </section>
      ${renderOpportunityTable(rows)}
      <section class="opportunity-list">
        ${opportunities.map(renderOpportunity).join('')}
      </section>
    </main>
  `;
}

renderShell(fallbackOpportunities, fallbackRows, 'Loading opportunity feed...');

Promise.all([fetchOpportunities(), fetchOpportunityRows()])
  .then(([opportunities, rows]) => {
    renderShell(opportunities, rows, 'Asset-first live spreads across venues.');
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    renderShell(fallbackOpportunities, fallbackRows, `API unavailable: ${message}`);
  });
