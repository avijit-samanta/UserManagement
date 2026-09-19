import { Router } from 'express';

// No auth required — this is what a container orchestrator (Docker
// HEALTHCHECK, Kubernetes liveness/readiness probes, a load balancer)
// polls to decide whether this instance is serving traffic correctly.
const router = Router();

router.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
