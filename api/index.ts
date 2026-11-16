import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from '../server/app.ts';

const globalForApp = globalThis as typeof globalThis & {
  __shopAdminVercelApp?: ReturnType<typeof createApiApp>;
};

function getExpressApp() {
  if (!globalForApp.__shopAdminVercelApp) {
    globalForApp.__shopAdminVercelApp = createApiApp();
  }
  return globalForApp.__shopAdminVercelApp;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const app = getExpressApp();
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
