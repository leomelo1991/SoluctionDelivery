import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { browserMapsKey } from './scripts/maps-config';
export default defineConfig(({ mode }) => {
  const environment = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  const key = browserMapsKey(environment);
  return {
    plugins: [react()],
    define: { 'import.meta.env.VITE_GOOGLE_MAPS_KEY': JSON.stringify(key) },
    server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
    build: { sourcemap: false },
  };
});
