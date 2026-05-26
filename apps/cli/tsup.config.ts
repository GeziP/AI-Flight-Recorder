import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: false,
  clean: true,
  splitting: false,
  sourcemap: true,
  noExternal: ['@aifr/core', '@aifr/event-schema'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
