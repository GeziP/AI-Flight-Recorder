import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false,
  clean: true,
  splitting: false,
  sourcemap: false,
  shims: true,
  noExternal: ['@aifr/core', '@aifr/event-schema', '@aifr/parser-claude', '@aifr/parser-codex', '@aifr/graph-builder', '@aifr/analyzer'],
  external: ['node-pty'],
});
