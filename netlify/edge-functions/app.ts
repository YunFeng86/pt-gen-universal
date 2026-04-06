import { handle } from 'hono/netlify';
import { createNetlifyRuntime } from '../../src/runtime/netlify';

let cachedHandlerPromise: Promise<(req: Request, context: any) => Response | Promise<Response>> | null =
  null;

type NetlifyEdgeGlobals = typeof globalThis & {
  Netlify?: {
    env?: Record<string, unknown> & {
      toObject?: () => Record<string, unknown>;
    };
  };
};

export function resolveNetlifyEnv(globals: NetlifyEdgeGlobals = globalThis as NetlifyEdgeGlobals) {
  const edgeEnv = globals.Netlify?.env;
  if (edgeEnv && typeof edgeEnv.toObject === 'function') {
    return edgeEnv.toObject();
  }

  if (edgeEnv) {
    return edgeEnv;
  }

  return typeof process !== 'undefined' ? process.env : {};
}

async function getHandler() {
  if (!cachedHandlerPromise) {
    const env = resolveNetlifyEnv();
    cachedHandlerPromise = createNetlifyRuntime(env).then((app) => handle(app));
  }

  return await cachedHandlerPromise;
}

export default async function netlifyEdgeEntry(request: Request, context: any) {
  const handler = await getHandler();
  return await handler(request, context);
}

export const config = {
  path: '/*',
};
