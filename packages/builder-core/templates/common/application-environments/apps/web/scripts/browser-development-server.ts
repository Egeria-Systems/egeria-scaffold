import { createServer, ServerResponse, type IncomingMessage, type OutgoingHttpHeader, type OutgoingHttpHeaders, type Server } from "node:http";
import type { Socket } from "node:net";
import { pathToFileURL } from "node:url";

export const guardedDevelopmentMode = "guarded-next-development";
export const guardedDevelopmentOrigin = "http://127.0.0.1:3100";
export const guardedDevelopmentServer = {
  command: "node --experimental-strip-types scripts/browser-development-server.ts --hostname 127.0.0.1 --port 3100",
  url: guardedDevelopmentOrigin, reuseExistingServer: false, timeout: 180_000,
} as const;

export function readDevelopmentTransportMode(baseURL: string, metadata: Readonly<Record<string, unknown>>, webServer: unknown): typeof guardedDevelopmentMode | undefined {
  const mode = metadata.applicationTransport;
  const server = webServer && typeof webServer === "object" && !Array.isArray(webServer) ? webServer as Record<string, unknown> : undefined;
  if (mode === undefined && server?.command !== guardedDevelopmentServer.command) return undefined;
  if (mode !== guardedDevelopmentMode || baseURL !== guardedDevelopmentOrigin ||
      server?.command !== guardedDevelopmentServer.command || server.url !== baseURL || server.reuseExistingServer !== false ||
      Object.keys(server).some(key => !["command", "url", "reuseExistingServer", "timeout"].includes(key))) {
    throw new Error("APPLICATION_TRANSPORT_DEVELOPMENT_CONFIG_INVALID");
  }
  return guardedDevelopmentMode;
}

const redirects = new Set([301, 302, 303, 307, 308]);
type Headers = OutgoingHttpHeaders | OutgoingHttpHeader[];

export class BrowserDevelopmentResponse<Request extends IncomingMessage = IncomingMessage> extends ServerResponse<Request> {
  readonly #browserRequest: boolean;
  constructor(request: Request) {
    super(request);
    this.#browserRequest = Object.hasOwn(request.headers, "sec-fetch-dest") || Object.hasOwn(request.headers, "sec-fetch-mode");
  }
  override writeHead(status: number, messageOrHeaders?: string | Headers, headers?: Headers): this {
    // Match Node's single coercion before deciding whether headers may be committed.
    const normalized = status | 0;
    if (this.#browserRequest && redirects.has(normalized)) { this.destroy(); return this; }
    return typeof messageOrHeaders === "string" ? super.writeHead(normalized, messageOrHeaders, headers) : super.writeHead(normalized, messageOrHeaders);
  }
  // Node's legacy alias points to the original method unless explicitly replaced.
  writeHeader(status: number, messageOrHeaders?: string | Headers, headers?: Headers): this {
    return this.writeHead(status, messageOrHeaders, headers);
  }
}

type DevelopmentApplication = Readonly<{
  prepare: () => Promise<void>;
  close: () => Promise<void>;
  getRequestHandler: () => (request: IncomingMessage, response: ServerResponse) => Promise<void>;
}>;

export async function runDevelopmentServer(server: Server, application: DevelopmentApplication) {
  const sockets = new Set<Socket>();
  server.on("connection", socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
  const preparing = Promise.resolve().then(() => application.prepare());
  let startupError: unknown;
  let stopping: Promise<void> | undefined;
  const stop = () => stopping ??= (async () => {
    const timeout = setTimeout(() => {
      console.error("BROWSER_DEVELOPMENT_SHUTDOWN_TIMEOUT");
      if (startupError !== undefined) console.error(startupError);
      process.exit(1);
    }, 15000);
    try {
      // Next registers initialization and cleanup during prepare, including on rejection.
      // Keep the deadline active until preparation and the resulting cleanup settle.
      await preparing.catch(() => {});
      const closed = server.listening ? new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) : Promise.resolve();
      for (const socket of sockets) socket.destroy();
      const results = await Promise.allSettled([closed, application.close()]);
      const failures = results.flatMap(result => result.status === "rejected" ? [result.reason] : []);
      if (failures.length) throw new AggregateError(failures, "BROWSER_DEVELOPMENT_SHUTDOWN_FAILED");
    } finally {
      clearTimeout(timeout);
      process.off("SIGINT", shutdown); process.off("SIGTERM", shutdown);
    }
  })();
  const shutdown = () => { void stop().catch(error => { console.error(error); process.exitCode = 1; }); };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  try {
    await preparing;
    if (!stopping) {
      const handler = application.getRequestHandler();
      server.on("request", (request, response) => { void handler(request, response).catch(error => { console.error(error); response.destroy(); }); });
      await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(3100, "127.0.0.1", resolve); });
    }
  } catch (error) {
    startupError = error;
    try { await stop(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], "BROWSER_DEVELOPMENT_STARTUP_FAILED"); }
    throw error;
  }
  if (stopping) await stopping;
}

async function startDevelopmentServer() {
  if (process.argv.slice(2).join(" ") !== "--hostname 127.0.0.1 --port 3100") throw new Error("BROWSER_DEVELOPMENT_ARGUMENTS_INVALID");
  const server = createServer({ ServerResponse: BrowserDevelopmentResponse });
  const { default: next } = await import("next");
  await runDevelopmentServer(server, next({ dev: true, hostname: "127.0.0.1", port: 3100, httpServer: server, turbopack: true }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startDevelopmentServer().catch(error => { console.error(error); process.exitCode = 1; });
}
