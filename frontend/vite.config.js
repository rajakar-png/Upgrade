import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false
  },
  server: {
    // Serve index.html for all unmatched routes so React Router can handle them
    // (required for direct URL access / page refresh on SPA routes)
    historyApiFallback: true
  }
})
