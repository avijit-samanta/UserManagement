import path from 'path';
// Loads .env from the repo root (three levels up from server/dist/index.js,
// matching the certs/ path resolution below) BEFORE anything else runs, so
// every module that reads SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY at request
// time — never at import time, so ordering here is just about being early
// enough — sees them. Explicit path because the process's cwd depends on
// how it was launched (npm workspace vs. Docker WORKDIR), and dotenv's
// default only checks cwd.
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { seedIfNeeded } from './data/seed';
import { attachUser } from './middleware/session';
import { errorHandler } from './middleware/errorHandler';
import { asyncHandler } from './utils/asyncHandler';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import usersRoutes from './routes/users';
import ticketsRoutes from './routes/tickets';
import attachmentsRoutes from './routes/attachments';

// Default 8080, not 4000: dev mode (server/package.json's "dev" script)
// explicitly sets PORT=4000 to match the Vite proxy target in
// client/vite.config.ts, so this fallback only applies to the production
// build/Docker image running standalone — keeping the two defaults distinct
// means `npm run dev` and `npm start` can run at the same time without a
// port collision.
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const HTTPS_PORT = process.env.HTTPS_PORT ? Number(process.env.HTTPS_PORT) : 4443;
// Bind explicitly to all IPv4 interfaces. Node's default (no host given)
// can end up IPv6-only ([::]) on some setups, which some browsers/embedded
// browser views can't reach via "localhost" -> 127.0.0.1. Matches the same
// fix applied to the Vite dev server in client/vite.config.ts.
const HOST = '0.0.0.0';

// TLS cert/key for HTTPS. Defaults to certs/{key,cert}.pem at the repo root
// (see "Running over HTTPS" in README.md for how to generate one locally);
// override with SSL_KEY_PATH / SSL_CERT_PATH for a real certificate in
// production. Missing either file falls back to HTTP-only so local dev
// keeps working without requiring a certificate.
const SSL_KEY_PATH = process.env.SSL_KEY_PATH
  ? path.resolve(process.env.SSL_KEY_PATH)
  : path.resolve(__dirname, '../../certs/key.pem');
const SSL_CERT_PATH = process.env.SSL_CERT_PATH
  ? path.resolve(process.env.SSL_CERT_PATH)
  : path.resolve(__dirname, '../../certs/cert.pem');

async function main() {
  await seedIfNeeded();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(asyncHandler(attachUser));

  // Unauthenticated on purpose — registered before any /api/* route so it
  // never depends on session/DB state to answer "am I up".
  app.use('/healthz', healthRoutes);

  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/tickets', ticketsRoutes);
  app.use('/api/attachments', attachmentsRoutes);

  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);

  // `npm run dev` sets DISABLE_HTTPS=true so the backend always stays plain
  // HTTP in local dev, regardless of whether certs/ happens to exist — the
  // Vite dev server proxies '/api' to plain http://localhost:PORT
  // (client/vite.config.ts), and that proxy target would break if this port
  // suddenly became redirect-only. HTTPS is for the production build/start
  // (and the Docker image), not the dev server.
  const httpsDisabled = process.env.DISABLE_HTTPS === 'true';
  const hasCerts = !httpsDisabled && fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH);

  if (hasCerts) {
    const credentials = {
      key: fs.readFileSync(SSL_KEY_PATH, 'utf-8'),
      cert: fs.readFileSync(SSL_CERT_PATH, 'utf-8'),
    };

    // The app itself is only ever served over HTTPS...
    https.createServer(credentials, app).listen(HTTPS_PORT, HOST, () => {
      console.log(`HTTPS server listening on https://localhost:${HTTPS_PORT}`);
    });

    // ...and PORT stays open only to redirect stray HTTP requests to it, so
    // the app is reachable on both ports without ever serving plaintext.
    // /healthz is the one exception: a health check hitting the plain HTTP
    // port should get a real answer, not a 301 it would have to follow (and
    // possibly fail TLS-trust on) just to learn the process is alive.
    http
      .createServer((req, res) => {
        if (req.url === '/healthz') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', mode: 'redirect-only' }));
          return;
        }
        const host = (req.headers.host ?? `localhost:${PORT}`).split(':')[0];
        res.writeHead(301, { Location: `https://${host}:${HTTPS_PORT}${req.url ?? ''}` });
        res.end();
      })
      .listen(PORT, HOST, () => {
        console.log(`HTTP server listening on http://localhost:${PORT} (redirects to HTTPS)`);
      });
  } else {
    if (httpsDisabled) {
      console.log(`HTTPS disabled (DISABLE_HTTPS=true, set by "npm run dev") — running HTTP only on port ${PORT}.`);
    } else {
      console.warn(
        `No TLS certificate found at ${SSL_CERT_PATH} — running HTTP only on port ${PORT}. ` +
          'See "Running over HTTPS" in README.md to generate a local certificate.',
      );
    }
    app.listen(PORT, HOST, () => {
      console.log(`HTTP server listening on http://localhost:${PORT}`);
    });
  }
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
