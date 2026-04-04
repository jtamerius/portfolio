import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  define: {
    // Expose only non-secret Cognito config via env vars
    // Secrets never go in frontend code
  },
})
