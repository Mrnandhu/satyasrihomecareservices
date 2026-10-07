import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';
import { localApi } from './dev/api-plugin.js';

export default defineConfig(({ mode }) => {
  // Reads ADMIN_PASSWORD from a .env.local file (see .env.example). Local testing only.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [localApi({ adminPassword: env.ADMIN_PASSWORD || 'test1234' })],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        // Two pages: the website and the admin dashboard
        input: {
          main: resolve(import.meta.dirname, 'index.html'),
          admin: resolve(import.meta.dirname, 'admin/index.html')
        }
      }
    },
    server: { port: 5173, host: true, allowedHosts: ['.trycloudflare.com'] },   // host: true lets you open it on your phone over Wi-Fi
    preview: { port: 4173, host: true }
  };
});
