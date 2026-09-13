import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'BarakaSELL Kassa',
        short_name: 'Kassa',
        theme_color: '#5980a6',
        background_color: '#f2f2f3',
        display: 'standalone',
      },
    }),
  ],
})
