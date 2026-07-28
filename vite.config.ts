import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base so a built site works from any path (GitHub Pages project sites,
  // opening dist/index.html straight off disk, etc).
  base: './',
  server: { port: 5173 },
})
