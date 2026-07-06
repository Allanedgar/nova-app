import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';
import type { ApiConfig } from './types.js';

export interface StartedServer {
  readonly close: () => Promise<void>;
  readonly port: number;
  readonly host: string;
}

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function requestUrl(request: IncomingMessage, host: string, port: number): string {
  const protocol = 'http';
  const headerHost = request.headers.host ?? `${host}:${port}`;
  return `${protocol}://${headerHost}${request.url ?? '/'}`;
}

function applyCors(response: ServerResponse, origin: string): void {
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function requestHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return headers;
}

async function writeFetchResponse(response: ServerResponse, fetchResponse: Response): Promise<void> {
  response.statusCode = fetchResponse.status;
  fetchResponse.headers.forEach((value, key) => response.setHeader(key, value));
  const body = Buffer.from(await fetchResponse.arrayBuffer());
  response.end(body);
}

export async function startServer(config: Partial<ApiConfig> = {}): Promise<StartedServer> {
  const app = createApp(config);
  const { host, port } = app.config;

  const server = createServer(async (request, response) => {
    applyCors(response, app.config.corsOrigin ?? '*');

    if (request.method === 'OPTIONS') {
      response.statusCode = 204;
      response.end();
      return;
    }

    try {
      const body = request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await readBody(request);
      const fetchRequest = new Request(requestUrl(request, host, port), {
        body,
        headers: requestHeaders(request),
        method: request.method,
      });
      const fetchResponse = await app.fetch(fetchRequest);
      await writeFetchResponse(response, fetchResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      response.statusCode = 500;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ error: message }));
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(port, host, resolve);
  });

  return {
    close: () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    }),
    host,
    port,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  const corsOrigin = process.env.CORS_ORIGIN ?? '*';

  startServer({ corsOrigin, host, port })
    .then((server) => {
      console.log(`Nova API listening on http://${server.host}:${server.port}`);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
