import React, { useMemo } from 'react';
import classNames from 'classnames';
import { motion } from 'framer-motion';
import { gaugeStyles } from './theme';

interface GuruloGaugeProps {
  value: number | null;
  max?: number;
  displayValue: string;
  label?: string;
  sublabel?: string | null;
  color?: string;
  trackColor?: string;
  size?: number;
  dataTestId?: string;
}

const clampNumber = (value: number, max: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (max <= 0) {
    return 0;
  }

  return Math.min(Math.max(value, 0), max);
};

const GuruloGauge: React.FC<GuruloGaugeProps> = ({
  value,
  max = 100,
  displayValue,
  label,
  sublabel,
  color = '#8b5cf6',
  trackColor = 'rgba(148, 163, 184, 0.25)',
  size = 96,
  dataTestId,
}) => {
  const { percentage, radius, circumference } = useMemo(() => {
    const safeValue = value === null ? 0 : clampNumber(value, max);
    const pct = max === 0 ? 0 : (safeValue / max) * 100;
    const r = (size - 12) / 2;
    const c = 2 * Math.PI * r;

    return {
      percentage: pct,
      radius: r,
      circumference: c,
    };
  }, [max, size, value]);

  const dashOffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center" data-testid={dataTestId}>
      <svg
        width={size}
        height={size}
        className={classNames('rotate-[-90deg]', gaugeStyles)}
        aria-hidden="true"
        role="presentation"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={trackColor}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transition={{
            type: 'spring',
            stiffness: 120,
            damping: 20,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <span className="text-xl font-bold text-white">{displayValue}</span>
        {sublabel ? <span className="text-xs font-medium text-slate-400">{sublabel}</span> : null}
      </div>
      {label ? <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p> : null}
    </div>
  );
};

export default GuruloGauge;
