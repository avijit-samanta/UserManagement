import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Without an explicit host, Vite/Node can bind only the IPv6 loopback
    // ([::1]) and skip IPv4 (127.0.0.1) — some browsers/embedded browser
    // views resolve "localhost" to 127.0.0.1 first and can't connect even
    // though the server is genuinely up. "0.0.0.0" forces the IPv4 listener.
    host: '0.0.0.0',
    // Fail loudly instead of silently moving to 5174+ when 5173 is taken —
    // a silently-shifted port is invisible until someone opens a stale tab.
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
