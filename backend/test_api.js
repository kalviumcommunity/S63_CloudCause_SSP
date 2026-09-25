import app from './src/server.js';

async function testAll() {
  console.log('Testing Backend API endpoints...');
  const baseUrl = 'http://localhost:5000';

  // Wait 500ms for server to bind
  await new Promise(r => setTimeout(r, 500));

  const endpoints = [
    '/api/health',
    '/api/dashboard',
    '/api/billing?page=1&limit=5',
    '/api/billing/services',
    '/api/deployments',
    '/api/usage',
    '/api/spikes'
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${baseUrl}${ep}`);
      const data = await res.json();
      console.log(`[PASS] ${ep} -> status: ${res.status}, items:`, Array.isArray(data) ? data.length : typeof data);
    } catch (err) {
      console.error(`[FAIL] ${ep} ->`, err.message);
    }
  }

  // Test spike details for first detected spike
  try {
    const spikesRes = await fetch(`${baseUrl}/api/spikes`);
    const spikes = await spikesRes.json();
    if (spikes.length > 0) {
      const spikeId = spikes[0].id;
      const detailRes = await fetch(`${baseUrl}/api/spikes/${spikeId}`);
      const detail = await detailRes.json();
      console.log(`[PASS] /api/spikes/${spikeId} ->`, {
        service: detail.billing.service_name,
        confidence: detail.confidenceLevel,
        hasPrimaryDeployment: !!detail.primaryDeployment,
        explanationPreview: detail.possibleExplanation.slice(0, 80) + '...'
      });
    }
  } catch (err) {
    console.error('[FAIL] Spike detail test:', err.message);
  }

  console.log('All backend API tests finished.');
  process.exit(0);
}

testAll();

