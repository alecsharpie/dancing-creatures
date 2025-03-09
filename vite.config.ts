import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/dancing-creatures/', // Set this to match your GitHub Pages repository name
  // Ensure static assets are properly served
  publicDir: 'public',
  build: {
    outDir: 'dist'
  }
})