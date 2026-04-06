import { handle } from 'hono/vercel';
import { createVercelRuntime } from './runtime/vercel';

let cachedHandlerPromise: Promise<(req: Request) => Response | Promise<Response>> | null = null;

async function getHandler() {
  if (!cachedHandlerPromise) {
    const env = typeof process !== 'undefined' ? process.env : {};
    cachedHandlerPromise = createVercelRuntime(env).then((app) => handle(app));
  }

  return await cachedHandlerPromise;
}

export default async function vercelEntry(request: Request) {
  const handler = await getHandler();
  return await handler(request);
}
