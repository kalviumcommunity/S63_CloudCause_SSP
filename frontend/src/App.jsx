import React, { useState, useEffect } from 'react';
import Layout from './components/layout/Layout';
import DashboardPage from './pages/DashboardPage';
import BillingPage from './pages/BillingPage';
import DeploymentsPage from './pages/DeploymentsPage';
import UsagePage from './pages/UsagePage';
import CostSpikesPage from './pages/CostSpikesPage';
import CostSpikeDetailPage from './pages/CostSpikeDetailPage';
import { fetchAllSpikes } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedSpikeId, setSelectedSpikeId] = useState(null);
  const [spikesCount, setSpikesCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load spike count for sidebar badge
  useEffect(() => {
    fetchAllSpikes()
      .then((spikes) => setSpikesCount(spikes?.length || 0))
      .catch(console.error);
  }, [refreshKey]);

  const handleInvestigateSpike = (spikeId) => {
    setSelectedSpikeId(spikeId);
    setActiveTab('spike-detail');
  };

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Determine header title and subtitle
  let title = 'Cloud Cost Attribution Dashboard';
  let subtitle = 'Correlating cloud infrastructure spending with software releases and compute usage';

  if (activeTab === 'billing') {
    title = 'Cloud Billing Records';
    subtitle = 'Daily infrastructure cost breakdown with anomaly classification';
  } else if (activeTab === 'deployments') {
    title = 'Deployment History';
    subtitle = 'Software releases and environment deployments compared against cost trends';
  } else if (activeTab === 'usage') {
    title = 'Service Usage Metrics';
    subtitle = 'CPU utilization, daily request volumes, and active instance auto-scaling';
  } else if (activeTab === 'spikes') {
    title = 'Identified Cost Spikes';
    subtitle = 'Cost anomalies exceeding 35% increase flagged for financial investigation';
  } else if (activeTab === 'spike-detail') {
    title = 'Cost Spike Attribution Analysis';
    subtitle = 'Detailed root cause correlation linking billing anomalies to software releases and compute surges';
  }

  return (
    <Layout
      activeTab={activeTab === 'spike-detail' ? 'spikes' : activeTab}
      onSelectTab={handleSelectTab}
      spikesCount={spikesCount}
      title={title}
      subtitle={subtitle}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
    >
      {activeTab === 'dashboard' && (
        <DashboardPage
          key={refreshKey}
          onInvestigateSpike={handleInvestigateSpike}
          onNavigate={handleSelectTab}
        />
      )}

      {activeTab === 'billing' && (
        <BillingPage
          key={refreshKey}
          onInvestigateSpike={handleInvestigateSpike}
        />
      )}

      {activeTab === 'deployments' && (
        <DeploymentsPage
          key={refreshKey}
          onInvestigateSpike={handleInvestigateSpike}
        />
      )}

      {activeTab === 'usage' && (
        <UsagePage key={refreshKey} />
      )}

      {activeTab === 'spikes' && (
        <CostSpikesPage
          key={refreshKey}
          onInvestigateSpike={handleInvestigateSpike}
        />
      )}

      {activeTab === 'spike-detail' && (
        <CostSpikeDetailPage
          spikeId={selectedSpikeId}
          onBack={() => setActiveTab('dashboard')}
          onSelectService={(service) => {
            setActiveTab('usage');
          }}
        />
      )}
    </Layout>
  );
}

