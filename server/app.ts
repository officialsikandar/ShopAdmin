import express from 'express';
import dotenv from 'dotenv';
import { connectToMongoDB } from './db.ts';
import { createApiRouter } from './routes.ts';

dotenv.config();

export function createApiApp(): express.Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Ensure pooled MongoDB connection is established on every serverless/local API request
  app.use('/api', async (_req, res, next) => {
    try {
      await connectToMongoDB();
      next();
    } catch (err) {
      console.error('MongoDB connection error:', err);
      res.status(503).json({
        error: 'Database temporarily unavailable. Please verify MONGODB_URI and retry.',
        code: 'DATABASE_UNAVAILABLE',
      });
    }
  });

  app.use('/api', createApiRouter());

  // Structured JSON fallback for unexpected server/body-parser errors
  app.use(
    (
      err: Error & { status?: number; type?: string },
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (!req.path.startsWith('/api')) {
        return next(err);
      }
      const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
      res.status(status).json({
        error: err.message || 'Internal server error',
      });
    }
  );

  return app;
}
