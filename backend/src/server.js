import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase } from './config/database.js';
import db from './config/database.js';
import { seedDatabase } from './data/seed.js';

import dashboardRoutes from './routes/dashboardRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import deploymentRoutes from './routes/deploymentRoutes.js';
import usageRoutes from './routes/usageRoutes.js';
import spikeRoutes from './routes/spikeRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());

// Initialize Database & Auto-Seed if empty
initDatabase();
try {
  const row = db.prepare('SELECT count(*) as count FROM billing_records').get();
  if (!row || row.count === 0) {
    console.log('Database empty on startup. Auto-seeding initial sample data...');
    seedDatabase();
  }
} catch (err) {
  console.warn('Auto-seed check encountered:', err.message);
  seedDatabase();
}

// Register API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'CloudCostAttribution-API', timestamp: new Date().toISOString() });
});

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/deployments', deploymentRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/spikes', spikeRoutes);

// Serve frontend static build if present
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`Cloud Cause Backend API & Dashboard running on http://localhost:${PORT}`);
});

export default app;

