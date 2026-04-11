import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { serve } from '@hono/node-server';
import { createNodeRuntime } from '../runtime/node';

/**
 * Node.js 运行时入口
 */

if (existsSync('.env')) {
  loadEnvFile('.env');
}

const runtime = await createNodeRuntime('node', process.env);

serve(
  {
    fetch: runtime.app.fetch,
    port: runtime.port,
  },
  (info) => {
    console.log(`🚀 PT-Gen server running on http://localhost:${info.port}`);
  }
);
