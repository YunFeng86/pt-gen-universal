import { createEdgeOneRuntime } from '../src/runtime/edgeone';

let cachedAppPromise: Promise<any> | null = null;

function getApp(context: any) {
  if (!cachedAppPromise) {
    cachedAppPromise = createEdgeOneRuntime(context.env || {});
  }

  return cachedAppPromise;
}

export default async function onRequest(context: any) {
  const app = await getApp(context);
  return await app.fetch(context.request, context.env, {
    waitUntil: context.waitUntil?.bind(context),
  });
}
