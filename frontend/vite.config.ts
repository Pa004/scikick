import { defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // never-cast: tailwind's plugin targets root Vite 8 while vitest/config
  // resolves its bundled Vite types. Runtime is unaffected.
  plugins: [tailwindcss() as unknown as never],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
})
