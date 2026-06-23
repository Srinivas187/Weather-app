import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // For Capacitor: no base path needed (serve from root)
  // base: '/my-app/',  ← keep this commented out for Capacitor builds
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'WeatherPulse',
        short_name: 'WeatherPulse',
        description: 'Real-time global weather intelligence — instant forecasts for any city.',
        theme_color: '#080e1c',
        background_color: '#080e1c',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['weather', 'utilities'],
        icons: [
          { src: 'pwa-192x192.png',  sizes: '192x192',  type: 'image/png' },
          { src: 'pwa-512x512.png',  sizes: '512x512',  type: 'image/png' },
          { src: 'pwa-512x512.png',  sizes: '512x512',  type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-api-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 10 },
            },
          },
          {
            urlPattern: /^https:\/\/geocoding-api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'geo-api-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
})
