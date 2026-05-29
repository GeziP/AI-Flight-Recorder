import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false,
  clean: true,
  splitting: false,
  sourcemap: false,
  shims: true,
  noExternal: ['@aifr/core', '@aifr/event-schema', '@aifr/parser-claude', '@aifr/parser-codex', '@aifr/parser-cursor', '@aifr/graph-builder', '@aifr/analyzer', '@aifr/search'],
  external: ['node-pty', 'better-sqlite3'],
});
