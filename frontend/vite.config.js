import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        vue(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon-512.png'],
            manifest: {
                name: 'Supika',
                short_name: 'Supika',
                description: 'Discover and join events. Vibe with your people.',
                theme_color: '#38bdf8',
                background_color: '#0d0d1a',
                display: 'standalone',
                orientation: 'portrait',
                scope: '/',
                start_url: '/',
                icons: [
                    {
                        src: 'icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            },
            workbox: {
                // Cache the app shell and key assets
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                runtimeCaching: [
                    {
                        // Cache API responses for events list
                        urlPattern: /\/api\/events$/,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-events',
                            expiration: { maxAgeSeconds: 300 } // 5 min
                        }
                    },
                    {
                        // Cache Unsplash images
                        urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'unsplash-images',
                            expiration: { maxEntries: 50, maxAgeSeconds: 86400 }
                        }
                    }
                ]
            }
        })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: {
        host: true
    }
})
