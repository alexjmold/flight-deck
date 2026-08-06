import { defineConfig } from 'tsup'

// ink and react stay external: tsup keeps anything in `dependencies` out of the
// bundle, so npm installs them alongside rather than us shipping a copy.
export default defineConfig({
  entry: ['src/cli.tsx'],
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  clean: true,
})
