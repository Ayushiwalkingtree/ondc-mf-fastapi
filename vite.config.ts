import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const httpTargetFromWsTarget = (value: string): string =>
  value.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8000';
  const wsTarget = env.VITE_WS_BASE_URL || apiTarget.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
  const workbenchTarget = env.VITE_WORKBENCH_BASE_URL || 'https://workbench.ondc.tech';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: wsTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        '/form-service': {
          target: workbenchTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
