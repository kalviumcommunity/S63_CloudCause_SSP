import React, { useRef, useEffect, useState } from 'react';
import { Layers, Activity, AlertTriangle, ShieldCheck, Zap, Maximize2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export default function Interactive3DCloudTopology({ onSelectService, onInvestigateSpike }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [rotation, setRotation] = useState({ x: 25, y: -35 });
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // 3D Nodes representing cloud services
  const nodes = [
    {
      id: 'worker',
      name: 'Worker Service',
      x: -120, y: -30, z: -40,
      cost: 585.00,
      status: 'Cost Spike',
      color: '#ef4444',
      glow: 'rgba(239, 68, 68, 0.4)',
      version: 'v2.4.0',
      cpu: 88.5,
      instances: 12,
      spikeId: 191
    },
    {
      id: 'payment',
      name: 'Payment API',
      x: 110, y: -50, z: -20,
      cost: 795.50,
      status: 'Cost Spike',
      color: '#f97316',
      glow: 'rgba(249, 115, 22, 0.4)',
      version: 'v3.1.2',
      cpu: 79.2,
      instances: 14,
      spikeId: 112
    },
    {
      id: 'rds',
      name: 'RDS Database',
      x: 0, y: 50, z: 80,
      cost: 860.00,
      status: 'Cost Spike',
      color: '#e11d48',
      glow: 'rgba(225, 29, 72, 0.4)',
      version: 'v1.9.0',
      cpu: 84.4,
      instances: 2,
      spikeId: 243
    },
    {
      id: 'search',
      name: 'Search Cluster',
      x: 130, y: 60, z: -70,
      cost: 295.00,
      status: 'Increased',
      color: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.3)',
      version: 'v1.4.1',
      cpu: 68.5,
      instances: 6,
      spikeId: 79
    },
    {
      id: 'auth',
      name: 'Auth Service',
      x: -140, y: 70, z: 50,
      cost: 85.00,
      status: 'Normal',
      color: '#10b981',
      glow: 'rgba(16, 185, 129, 0.3)',
      version: 'v1.2.0',
      cpu: 28.0,
      instances: 2,
      spikeId: null
    }
  ];

  // Connection edges between microservices
  const edges = [
    { from: 'auth', to: 'payment' },
    { from: 'payment', to: 'rds' },
    { from: 'worker', to: 'rds' },
    { from: 'search', to: 'rds' },
    { from: 'auth', to: 'worker' }
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let time = 0;

    // Particles moving along edges
    const particles = [];
    for (let i = 0; i < 24; i++) {
      particles.push({
        edgeIndex: i % edges.length,
        progress: Math.random(),
        speed: 0.004 + Math.random() * 0.006,
        size: 1.5 + Math.random() * 1.5
      });
    }

    const resize = () => {
      if (!canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth * window.devicePixelRatio;
      canvas.height = 360 * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    // 3D projection math
    const project = (x, y, z, rotX, rotY, w, h) => {
      const radX = (rotX * Math.PI) / 180;
      const radY = (rotY * Math.PI) / 180;

      // Rotate Y
      const x1 = x * Math.cos(radY) + z * Math.sin(radY);
      const z1 = -x * Math.sin(radY) + z * Math.cos(radY);

      // Rotate X
      const y2 = y * Math.cos(radX) - z1 * Math.sin(radX);
      const z2 = y * Math.sin(radX) + z1 * Math.cos(radX);

      // Perspective projection
      const cameraDistance = 380;
      const fov = cameraDistance / (cameraDistance + z2);

      return {
        x: w / 2 + x1 * fov,
        y: h / 2 + y2 * fov,
        scale: fov,
        depth: z2
      };
    };

    const render = () => {
      time += 0.015;
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;

      ctx.clearRect(0, 0, w, h);

      // Render 3D Background Grid Plane (Cyber-isometric ground)
      const gridSize = 220;
      const gridSteps = 6;
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';

      for (let i = -gridSteps; i <= gridSteps; i++) {
        const p1 = project(i * (gridSize / gridSteps), 120, -gridSize, rotation.x, rotation.y + Math.sin(time * 0.1) * 2, w, h);
        const p2 = project(i * (gridSize / gridSteps), 120, gridSize, rotation.x, rotation.y + Math.sin(time * 0.1) * 2, w, h);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const p3 = project(-gridSize, 120, i * (gridSize / gridSteps), rotation.x, rotation.y + Math.sin(time * 0.1) * 2, w, h);
        const p4 = project(gridSize, 120, i * (gridSize / gridSteps), rotation.x, rotation.y + Math.sin(time * 0.1) * 2, w, h);
        ctx.beginPath();
        ctx.moveTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.stroke();
      }

      // Project all nodes
      const projectedNodes = nodes.map(n => {
        // Subtle floating bob
        const bob = Math.sin(time * 1.5 + n.x) * 4;
        const p = project(n.x, n.y + bob, n.z, rotation.x, rotation.y, w, h);
        return { ...n, px: p.x, py: p.y, scale: p.scale, depth: p.depth };
      });

      // Sort by depth (painter's algorithm)
      projectedNodes.sort((a, b) => b.depth - a.depth);

      // Draw 3D Edges
      edges.forEach(edge => {
        const fromNode = projectedNodes.find(n => n.id === edge.from);
        const toNode = projectedNodes.find(n => n.id === edge.to);
        if (!fromNode || !toNode) return;

        const hasSpike = fromNode.status === 'Cost Spike' || toNode.status === 'Cost Spike';
        ctx.beginPath();
        ctx.moveTo(fromNode.px, fromNode.py);
        ctx.lineTo(toNode.px, toNode.py);
        ctx.strokeStyle = hasSpike ? 'rgba(239, 68, 68, 0.35)' : 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = hasSpike ? 2 : 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Draw moving traffic particles
      particles.forEach(p => {
        p.progress += p.speed;
        if (p.progress > 1) p.progress = 0;

        const edge = edges[p.edgeIndex];
        const fromNode = projectedNodes.find(n => n.id === edge.from);
        const toNode = projectedNodes.find(n => n.id === edge.to);
        if (!fromNode || !toNode) return;

        const curX = fromNode.px + (toNode.px - fromNode.px) * p.progress;
        const curY = fromNode.py + (toNode.py - fromNode.py) * p.progress;

        ctx.beginPath();
        ctx.arc(curX, curY, p.size, 0, Math.PI * 2);
        ctx.fillStyle = fromNode.status === 'Cost Spike' ? '#f87171' : '#60a5fa';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw 3D Nodes
      projectedNodes.forEach(node => {
        const radius = 22 * node.scale;

        // Outer Alert Pulsing Ring for Cost Spikes
        if (node.status === 'Cost Spike') {
          const pulse = (Math.sin(time * 3) + 1) * 0.5;
          ctx.beginPath();
          ctx.arc(node.px, node.py, radius + 10 + pulse * 8, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 - pulse * 0.3})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Shadow / Ground Glow
        const gradient = ctx.createRadialGradient(
          node.px, node.py, radius * 0.5,
          node.px, node.py, radius * 2.2
        );
        gradient.addColorStop(0, node.glow);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.px, node.py, radius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // 3D Sphere Core
        const sphereGrad = ctx.createRadialGradient(
          node.px - radius * 0.3, node.py - radius * 0.3, radius * 0.1,
          node.px, node.py, radius
        );
        sphereGrad.addColorStop(0, '#ffffff');
        sphereGrad.addColorStop(0.3, node.color);
        sphereGrad.addColorStop(1, '#0f172a');

        ctx.beginPath();
        ctx.arc(node.px, node.py, radius, 0, Math.PI * 2);
        ctx.fillStyle = sphereGrad;
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner border ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Node Label
        ctx.font = `600 ${Math.max(10, 12 * node.scale)}px Inter, sans-serif`;
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.fillText(node.name, node.px, node.py + radius + 15);

        // Subtitle badge
        ctx.font = `500 ${Math.max(9, 10 * node.scale)}px monospace`;
        ctx.fillStyle = node.status === 'Cost Spike' ? '#fca5a5' : '#94a3b8';
        ctx.fillText(`$${node.cost.toFixed(0)}/day • ${node.version}`, node.px, node.py + radius + 28);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [rotation]);

  // Handle Drag / Rotation
  const handleMouseDown = (e) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    setRotation(prev => ({
      x: Math.max(10, Math.min(60, prev.x - dy * 0.3)),
      y: prev.y + dx * 0.4
    }));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  return (
    <div className="relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-2xl border border-slate-800 p-6 shadow-2xl overflow-hidden group">
      {/* 3D Visualizer Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-3 z-10 relative">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Live 3D Infrastructure Topology & Anomaly Mesh
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                REAL-TIME
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Interactive 3D spatial model correlating cluster deployments and telemetry
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-[11px] font-medium">Cost Spike Alert</span>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            <span className="text-[11px] font-medium">Elevated</span>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-[11px] font-medium">Normal</span>
          </div>
        </div>
      </div>

      {/* 3D Canvas Container */}
      <div
        ref={containerRef}
        className="relative w-full h-[360px] cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />

        {/* Floating Quick Action Cards on Top of 3D Canvas */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between pointer-events-none gap-2">
          <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-300 shadow-xl flex items-center space-x-3">
            <span className="text-[11px] font-semibold text-slate-400">Drag to rotate 3D view</span>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => setRotation({ x: 25, y: -35 })}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-medium underline"
            >
              Reset Camera
            </button>
          </div>

          <div className="pointer-events-auto flex items-center space-x-2">
            {nodes.filter(n => n.status === 'Cost Spike').map(spike => (
              <button
                key={spike.id}
                onClick={() => onInvestigateSpike && onInvestigateSpike(spike.spikeId)}
                className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-lg hover:scale-105"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span>Investigate {spike.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

