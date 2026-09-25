import React, { useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function StatCard({ title, value, change, changeText, icon: Icon, isNegativeGood = true }) {
  const cardRef = useRef(null);
  const [style, setStyle] = useState({});
  const [glare, setGlare] = useState({ opacity: 0, x: 50, y: 50 });

  const hasChange = change !== undefined && change !== null;
  const numChange = hasChange ? Number(change) : 0;
  const isZero = numChange === 0;
  const isUp = numChange > 0;
  
  let trendColor = 'text-slate-500 bg-slate-100';
  if (hasChange && !isZero) {
    if (isNegativeGood) {
      trendColor = isUp ? 'text-red-700 bg-red-50 border border-red-200' : 'text-emerald-700 bg-emerald-50 border border-emerald-200';
    } else {
      trendColor = isUp ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-red-700 bg-red-50 border border-red-200';
    }
  }

  // 3D Perspective Tilt on Hover
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = -((y - centerY) / centerY) * 7;
    const rotY = ((x - centerX) / centerX) * 7;

    setStyle({
      transform: `perspective(800px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`,
      transition: 'transform 0.1s ease-out'
    });

    setGlare({
      opacity: 0.15,
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100
    });
  };

  const handleMouseLeave = () => {
    setStyle({
      transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.5s ease-out'
    });
    setGlare({ opacity: 0, x: 50, y: 50 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={style}
      className="relative bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-xl transition-shadow overflow-hidden cursor-default transform-gpu"
    >
      {/* 3D Specular Dynamic Glare */}
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl transition-opacity duration-300"
        style={{
          opacity: glare.opacity,
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(59, 130, 246, 0.4), transparent 60%)`
        }}
      />

      <div className="flex items-center justify-between mb-3 relative z-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
        {Icon && (
          <div className="p-2.5 rounded-xl bg-slate-50 text-slate-700 border border-slate-100 shadow-sm">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="flex items-baseline space-x-2 relative z-10">
        <div className="text-2xl font-bold text-slate-900 tracking-tight">{value}</div>
      </div>

      {hasChange && (
        <div className="mt-3 flex items-center space-x-2 text-xs relative z-10">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold ${trendColor}`}>
            {isZero ? (
              <Minus className="w-3 h-3 mr-1" />
            ) : isUp ? (
              <TrendingUp className="w-3 h-3 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-1" />
            )}
            {isUp && '+'}{numChange}%
          </span>
          {changeText && <span className="text-slate-500 font-medium">{changeText}</span>}
        </div>
      )}
    </div>
  );
}
