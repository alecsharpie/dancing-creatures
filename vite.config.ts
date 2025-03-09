import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/dancing-creatures/', // Set this to match your GitHub Pages repository name
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Ensure large binary files are copied as-is
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  // Explicitly configure the public directory
  publicDir: 'public',
  // Add resolve aliases for clarity
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})