import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import dotenv from 'dotenv';
import { connectToMongoDB } from './server/db.ts';
import { createApiRouter } from './server/routes.ts';

dotenv.config();

async function startServer() {
  await connectToMongoDB();

  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '10mb' }));
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
  app.use('/api', createApiRouter());

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));

    app.get(['/admin', '/admin/*'], (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });

    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'customer_web/index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      try {
        const reqPath = req.path || '/';
        if (reqPath.startsWith('/api')) {
          return next();
        }

        const isAdminRoute = reqPath === '/admin' || reqPath.startsWith('/admin/');
        const templatePath = isAdminRoute
          ? path.resolve(process.cwd(), 'index.html')
          : path.resolve(process.cwd(), 'customer_web/index.html');

        const rawHtml = fs.readFileSync(templatePath, 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`ShopAdmin server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ShopAdmin server:', err);
  process.exit(1);
});
