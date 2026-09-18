import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { seedIfNeeded } from './data/seed';
import { attachUser } from './middleware/session';
import { errorHandler } from './middleware/errorHandler';
import { asyncHandler } from './utils/asyncHandler';
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import usersRoutes from './routes/users';
import ticketsRoutes from './routes/tickets';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
// Bind explicitly to all IPv4 interfaces. Node's default (no host given)
// can end up IPv6-only ([::]) on some setups, which some browsers/embedded
// browser views can't reach via "localhost" -> 127.0.0.1. Matches the same
// fix applied to the Vite dev server in client/vite.config.ts.
const HOST = '0.0.0.0';

async function main() {
  await seedIfNeeded();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(asyncHandler(attachUser));

  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/tickets', ticketsRoutes);

  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);

  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
