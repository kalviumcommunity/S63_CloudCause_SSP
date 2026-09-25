import * as localStore from './localDataStore';

const BASE_URL = '/api';

export async function fetchDashboardSummary() {
  try {
    const res = await fetch(`${BASE_URL}/dashboard`);
    if (res.ok) return await res.json();
  } catch (e) {
    // Backend offline or proxy error
  }
  return localStore.getLocalDashboard();
}

export async function fetchBillingRecords(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.service && params.service !== 'All') query.set('service', params.service);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.status && params.status !== 'All') query.set('status', params.status);
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);

    const res = await fetch(`${BASE_URL}/billing?${query.toString()}`);
    if (res.ok) return await res.json();
  } catch (e) {
    // Fallback
  }
  return localStore.getLocalBilling(params);
}

export async function fetchServicesList() {
  try {
    const res = await fetch(`${BASE_URL}/billing/services`);
    if (res.ok) return await res.json();
  } catch (e) {
    // Fallback
  }
  return localStore.getLocalServices();
}

export async function fetchDeployments(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.service && params.service !== 'All') query.set('service', params.service);
    if (params.environment && params.environment !== 'All') query.set('environment', params.environment);
    if (params.status && params.status !== 'All') query.set('status', params.status);

    const res = await fetch(`${BASE_URL}/deployments?${query.toString()}`);
    if (res.ok) return await res.json();
  } catch (e) {
    // Fallback
  }
  return localStore.getLocalDeployments(params);
}

export async function fetchUsageMetrics(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.service && params.service !== 'All') query.set('service', params.service);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);

    const res = await fetch(`${BASE_URL}/usage?${query.toString()}`);
    if (res.ok) return await res.json();
  } catch (e) {
    // Fallback
  }
  return localStore.getLocalUsage(params);
}

export async function fetchAllSpikes(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.service && params.service !== 'All') query.set('service', params.service);

    const res = await fetch(`${BASE_URL}/spikes?${query.toString()}`);
    if (res.ok) return await res.json();
  } catch (e) {
    // Fallback
  }
  return localStore.getLocalSpikes(params);
}

export async function fetchSpikeDetails(id) {
  try {
    const res = await fetch(`${BASE_URL}/spikes/${id}`);
    if (res.ok) return await res.json();
  } catch (e) {
    // Fallback
  }
  return localStore.getLocalSpikeDetail(id);
}
