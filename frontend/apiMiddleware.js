import * as localStore from './src/services/localDataStore.js';

export function createApiMiddleware() {
  return async function apiMiddleware(req, res, next) {
    if (!req.url.startsWith('/api')) {
      return next();
    }

    const urlObj = new URL(req.url, 'http://localhost');
    const pathname = urlObj.pathname;
    const params = Object.fromEntries(urlObj.searchParams.entries());

    // First try forward to real backend on 5000 if it is alive
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300);
      const backendRes = await fetch(`http://127.0.0.1:5000${req.url}`, {
        method: req.method,
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (backendRes.ok) {
        const data = await backendRes.text();
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = backendRes.status;
        res.end(data);
        return;
      }
    } catch (e) {
      // Backend not running on 5000 — seamlessly serve from localStore without any terminal error
    }

    // Serve from localStore
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
      if (pathname === '/api/health') {
        res.end(JSON.stringify({ status: 'ok', service: 'CloudCause-ViteIntegrated' }));
        return;
      }

      if (pathname === '/api/dashboard') {
        const data = localStore.getLocalDashboard();
        res.end(JSON.stringify(data));
        return;
      }

      if (pathname === '/api/billing/services') {
        const data = localStore.getLocalServices();
        res.end(JSON.stringify(data));
        return;
      }

      if (pathname === '/api/billing') {
        const data = localStore.getLocalBilling(params);
        res.end(JSON.stringify(data));
        return;
      }

      if (pathname === '/api/deployments') {
        const data = localStore.getLocalDeployments(params);
        res.end(JSON.stringify(data));
        return;
      }

      if (pathname === '/api/usage') {
        const data = localStore.getLocalUsage(params);
        res.end(JSON.stringify(data));
        return;
      }

      if (pathname === '/api/spikes') {
        const data = localStore.getLocalSpikes(params);
        res.end(JSON.stringify(data));
        return;
      }

      if (pathname.startsWith('/api/spikes/')) {
        const id = pathname.replace('/api/spikes/', '');
        const data = localStore.getLocalSpikeDetail(id);
        if (data) {
          res.end(JSON.stringify(data));
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Spike not found' }));
        }
        return;
      }

      // Default fallback
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  };
}

