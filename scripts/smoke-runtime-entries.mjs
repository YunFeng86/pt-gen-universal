const entryChecks = [
  {
    name: 'vercel api route',
    url: new URL('../api/[[...route]].ts', import.meta.url),
    validate(mod) {
      if (mod.config?.runtime !== 'edge') {
        throw new Error('expected config.runtime to be "edge"');
      }
      if (typeof mod.default !== 'function') {
        throw new Error('expected default export to be a function');
      }
    },
  },
  {
    name: 'edgeone runtime entry',
    url: new URL('../edge-functions/index.ts', import.meta.url),
    validate(mod) {
      if (typeof mod.default !== 'function') {
        throw new Error('expected default export to be a function');
      }
    },
  },
  {
    name: 'edgeone default passthrough entry',
    url: new URL('../edge-functions/[[default]].ts', import.meta.url),
    validate(mod) {
      if (typeof mod.default !== 'function') {
        throw new Error('expected default export to be a function');
      }
    },
  },
  {
    name: 'netlify edge entry',
    url: new URL('../netlify/edge-functions/app.ts', import.meta.url),
    validate(mod) {
      if (typeof mod.default !== 'function') {
        throw new Error('expected default export to be a function');
      }
      if (mod.config?.path !== '/*') {
        throw new Error('expected config.path to be "/*"');
      }
    },
  },
];

for (const entry of entryChecks) {
  const mod = await import(entry.url);
  entry.validate(mod);
  console.log(`[runtime-smoke] ok: ${entry.name}`);
}
