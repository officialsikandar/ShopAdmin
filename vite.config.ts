import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'shopadmin-entry-routing-layout',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) return;
          const distDir = path.resolve(__dirname, 'dist');
          const builtRootAdmin = path.join(distDir, 'index.html');
          const builtCustomer = path.join(distDir, 'customer_web', 'index.html');
          const targetAdmin = path.join(distDir, 'admin.html');
          const targetCustomer = path.join(distDir, 'index.html');

          if (fs.existsSync(builtRootAdmin) && fs.existsSync(builtCustomer)) {
            fs.renameSync(builtRootAdmin, targetAdmin);
            fs.renameSync(builtCustomer, targetCustomer);
            fs.rmSync(path.join(distDir, 'customer_web'), { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          customer: path.resolve(__dirname, 'customer_web/index.html'),
          admin: path.resolve(__dirname, 'index.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
