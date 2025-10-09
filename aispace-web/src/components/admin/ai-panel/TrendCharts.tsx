import { useId } from 'react';
import type { TrendData } from './types';

interface LineTrendChartProps extends TrendData {
  stroke?: string;
}

export function LineTrendChart({ labels, values, stroke = '#60a5fa' }: LineTrendChartProps) {
  const gradientId = useId();
  const width = 320;
  const height = 140;
  const paddingX = 24;
  const paddingY = 18;

  if (values.length === 0) {
    return <div className="grid h-40 place-content-center text-sm text-[#6F7280]">მონაცემები არ არის</div>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const getX = (index: number) => {
    if (values.length === 1) return width / 2;
    const innerWidth = width - paddingX * 2;
    return paddingX + (innerWidth * index) / (values.length - 1);
  };

  const getY = (value: number) => {
    const innerHeight = height - paddingY * 2;
    return height - paddingY - ((value - min) / range) * innerHeight;
  };

  const baselineY = height - paddingY;

  const linePath = values
    .map((value, index) => {
      const x = getX(index);
      const y = getY(value);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const areaPath = `${linePath} L ${getX(values.length - 1)} ${baselineY} L ${getX(0)} ${baselineY} Z`;

  const tickCount = 3;
  const ticks = Array.from({ length: tickCount }, (_, index) => baselineY - ((index + 1) * (baselineY - paddingY)) / tickCount);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Usage trend chart" className="h-44 w-full">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill="none" />
      {ticks.map((tickY) => (
        <line key={tickY} x1={paddingX} y1={tickY} x2={width - paddingX} y2={tickY} stroke="rgba(148, 163, 184, 0.16)" strokeDasharray="4 6" />
      ))}
      <line x1={paddingX} y1={baselineY} x2={width - paddingX} y2={baselineY} stroke="rgba(148, 163, 184, 0.4)" />
      {values.length > 1 && <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />}
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((value, index) => (
        <g key={`${value}-${index}`}>
          <circle cx={getX(index)} cy={getY(value)} r={3.2} fill="#0f172a" stroke={stroke} strokeWidth={1.6} />
        </g>
      ))}
      {labels.map((label, index) => (
        <text
          key={label}
          x={getX(index)}
          y={height - 4}
          textAnchor="middle"
          className="text-[10px] fill-slate-400"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

interface BarTrendChartProps extends TrendData {
  barColor?: string;
}

export function BarTrendChart({ labels, values, barColor = '#22d3ee' }: BarTrendChartProps) {
  const width = 320;
  const height = 140;
  const paddingX = 24;
  const paddingY = 18;

  if (values.length === 0) {
    return <div className="grid h-40 place-content-center text-sm text-[#6F7280]">მონაცემები არ არის</div>;
  }

  const max = Math.max(...values, 0);
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const gap = innerWidth / values.length;
  const barWidth = Math.max(gap * 0.5, 12);
  const baselineY = height - paddingY;

  const tickCount = 3;
  const ticks = Array.from({ length: tickCount }, (_, index) => baselineY - ((index + 1) * innerHeight) / tickCount);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Average session length chart" className="h-44 w-full">
      {ticks.map((tickY) => (
        <line key={tickY} x1={paddingX} y1={tickY} x2={width - paddingX} y2={tickY} stroke="rgba(148, 163, 184, 0.16)" strokeDasharray="4 6" />
      ))}
      <line x1={paddingX} y1={baselineY} x2={width - paddingX} y2={baselineY} stroke="rgba(148, 163, 184, 0.4)" />
      {values.map((value, index) => {
        const scaled = max === 0 ? 0 : (value / max) * innerHeight;
        const x = paddingX + index * gap + gap / 2 - barWidth / 2;
        const y = baselineY - scaled;
        return (
          <g key={`${value}-${index}`}>
            <rect x={x} y={y} width={barWidth} height={scaled} rx={6} fill={barColor} fillOpacity={0.75} />
            <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="text-[10px] fill-slate-300">
              {value.toFixed(1)}
            </text>
          </g>
        );
      })}
      {labels.map((label, index) => (
        <text key={label} x={paddingX + index * gap + gap / 2} y={height - 4} textAnchor="middle" className="text-[10px] fill-slate-400">
          {label}
        </text>
      ))}
    </svg>
  );
}
