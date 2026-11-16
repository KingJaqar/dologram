// Execute the actual Edge entry points against disposable Auth/REST. Only the
// Deno env/serve host surface and npm import resolution are adapted to Node.
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { source, anonKey } from './fixture.mts';

type Handler = (request: Request) => Response | Promise<Response>;
export async function edgeHandlers() {
  const directory = await mkdtemp(resolve('../../.tmp/admin-phase8-edge-'));
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Deno');
  const handlers: Handler[] = [];
  const values: Record<string, string> = { SUPABASE_URL: source.SUPABASE_URL,
    SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: source.SUPABASE_SECRET_KEY };
  Object.defineProperty(globalThis, 'Deno', { configurable: true, value: {
    env: { get: (name: string) => values[name] },
    serve: (handler: Handler) => { handlers.push(handler); },
  } });
  try {
    for (const name of ['memo-sync', 'memo-pin-reset']) {
      const outfile = resolve(directory, `${name}.mjs`);
      await build({ entryPoints: [resolve('../../supabase/functions', name, 'index.ts')],
        outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external',
        plugins: [{ name: 'pinned-deno-npm', setup(builder) {
          builder.onResolve({ filter: /^npm:/ }, args => {
            if (args.path !== 'npm:@supabase/supabase-js@2.119.0') throw Error('Unexpected Edge dependency');
            return { path: '@supabase/supabase-js', external: true };
          });
        } }],
      });
      await import(pathToFileURL(outfile).href);
    }
    if (handlers.length !== 2) throw Error('Edge entry points not captured');
    return { handlers, async close() {
      if (previous) Object.defineProperty(globalThis, 'Deno', previous);
      else Reflect.deleteProperty(globalThis, 'Deno');
      await rm(directory, { recursive: true });
    } };
  } catch (error) {
    if (previous) Object.defineProperty(globalThis, 'Deno', previous);
    else Reflect.deleteProperty(globalThis, 'Deno');
    await rm(directory, { recursive: true });
    throw error;
  }
}
