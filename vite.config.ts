import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const appEnv = env.VITE_APP_ENV || env.VITE_ENVIRONMENT || 'dev';
  const isStaging = appEnv === 'test' || appEnv === 'staging';

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'assets/brand/app_icon/logo-512.png',
          'assets/brand/app_icon/logo-256.png',
          'assets/brand/app_icon/logo-192.png'
        ],
        manifest: {
          id: isStaging ? '/orderli-staging-pwa' : '/orderli-pwa',
          name: isStaging ? 'Orderli (Staging)' : 'Orderli - Order Management System',
          short_name: isStaging ? 'Orderli STG' : 'Orderli',
          description: isStaging
            ? 'Orderli Staging Environment - For testing purposes only.'
            : 'See every purchase. Know every customer. Keep every order in order.',
          theme_color: isStaging ? '#f97316' : '#000000', // Orange for staging
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          categories: ['business', 'productivity', 'utilities'],
          icons: [
            {
              src: '/assets/brand/app_icon/logo-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/assets/brand/app_icon/logo-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/assets/brand/app_icon/logo-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ],
          shortcuts: [
            {
              name: 'Dashboard',
              short_name: 'Dashboard',
              url: '/dashboard',
              icons: [{ src: '/assets/brand/app_icon/logo-128.png', sizes: '96x96' }]
            },
            {
              name: 'View Orders',
              short_name: 'Orders',
              url: '/purchases',
              icons: [{ src: '/assets/brand/app_icon/logo-128.png', sizes: '96x96' }]
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: false,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api/, /^\/supabase/],
          maximumFileSizeToCacheInBytes: 20 * 1024 * 1024, // 20MB to accommodate large bundles
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: isStaging ? 'supabase-api-cache-staging' : 'supabase-api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 5 // 5 minutes
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: isStaging ? 'supabase-storage-cache-staging' : 'supabase-storage-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: false
        }
      })
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime"],
    },
    optimizeDeps: {
      include: ["@tanstack/react-query"],
    },
    define: {
      global: 'globalThis',
    },
    esbuild: {
      drop: mode === 'production' && !isStaging ? ['console', 'debugger'] : [],
    },
    build: {
      minify: 'esbuild',
    },
  };
});