import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: false,
  clean: true,
  splitting: false,
  sourcemap: true,
  noExternal: ['@aifr/core', '@aifr/event-schema', '@aifr/parser-claude', '@aifr/parser-codex'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
