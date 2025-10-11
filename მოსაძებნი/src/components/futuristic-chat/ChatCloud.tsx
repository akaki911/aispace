import { motion, type Transition } from 'framer-motion';
import { useMemo } from 'react';

export interface ChatCloudProps {
  position: { x: number; y: number };
  onOpen: () => void;
  onHoverChange: (hovered: boolean) => void;
  isHovered: boolean;
  isListening: boolean;
  languageLabel: string;
}

const cloudVariants = {
  idle: {
    scale: 1,
    filter: 'drop-shadow(0 14px 28px rgba(5, 150, 105, 0.28))',
  },
  hover: {
    scale: 1.08,
    filter: 'drop-shadow(0 20px 40px rgba(16, 185, 129, 0.35))',
  },
};

const pulseTransition: Transition = {
  repeat: Infinity,
  duration: 3.2,
  ease: [0.42, 0, 0.58, 1],
};

const tailWagTransition: Transition = {
  repeat: Infinity,
  duration: 1.8,
  ease: [0.45, 0.05, 0.55, 0.95],
};

export function ChatCloud({
  position,
  onOpen,
  onHoverChange,
  isHovered,
  isListening,
  languageLabel,
}: ChatCloudProps) {
  const label = useMemo(
    () => (isListening ? `${languageLabel} · გისმენთ` : `${languageLabel} · მზადაა`),
    [isListening, languageLabel],
  );

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.75 }}
      transition={{ type: 'spring', stiffness: 280, damping: 20 }}
      aria-label="Gurulo Assistant"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
      onClick={onOpen}
      className="fixed z-[60] isolate flex h-16 w-16 items-center justify-center rounded-[24px] bg-gradient-to-br from-emerald-500 via-emerald-400 to-teal-400 text-white shadow-[0_22px_45px_rgba(16,185,129,0.32)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
      style={{
        left: position.x,
        top: position.y,
      }}
      whileHover="hover"
      variants={cloudVariants}
    >
      <motion.div
        className="relative flex h-14 w-14 items-center justify-center"
        animate={{
          y: [0, -3, 0],
          boxShadow: [
            '0 14px 32px rgba(5,150,105,0.35)',
            '0 18px 44px rgba(22,163,74,0.45)',
            '0 14px 32px rgba(5,150,105,0.35)',
          ],
        }}
        transition={{ repeat: Infinity, duration: 6, ease: [0.42, 0, 0.58, 1] }}
      >
        <motion.span
          className="absolute -left-3 top-3 h-6 w-6 -rotate-6 rounded-[12px] bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-500 blur-[0.5px]"
          animate={{ rotate: [-8, -4, -8] }}
          transition={tailWagTransition}
        />
        <motion.span
          className="absolute -right-3 top-3 h-6 w-6 rotate-6 rounded-[12px] bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-500 blur-[0.5px]"
          animate={{ rotate: [8, 4, 8] }}
          transition={tailWagTransition}
        />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-[22px] bg-gradient-to-br from-emerald-100 via-white to-emerald-200 shadow-inner shadow-emerald-600/30">
          <div className="absolute inset-x-2 -top-2 flex justify-between">
            <span className="h-5 w-5 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-900/40" />
            <span className="h-5 w-5 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-900/40" />
          </div>
          <div className="relative flex h-12 w-12 flex-col items-center justify-center rounded-full bg-gradient-to-br from-white via-emerald-50 to-emerald-100">
            <span className="absolute -bottom-1 h-5 w-10 rounded-full bg-gradient-to-br from-emerald-400/70 via-emerald-500/80 to-teal-500/70 blur-[1px]" />
            <div className="flex w-full items-center justify-between px-3 pt-4">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-700 shadow-inner shadow-emerald-950/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-700 shadow-inner shadow-emerald-950/50" />
            </div>
            <div className="relative mt-2 h-6 w-8 rounded-b-[18px] bg-gradient-to-b from-emerald-200 via-emerald-300 to-emerald-400">
              <div className="absolute left-1/2 top-0 h-2 w-3 -translate-x-1/2 rounded-b-full bg-emerald-500/90" />
              <div className="absolute inset-x-1 bottom-1 h-2 rounded-full bg-white/70" />
              <motion.div
                className="absolute inset-x-0 -bottom-3 mx-auto flex h-4 w-10 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-50 shadow-md"
                animate={{ opacity: [0.9, 1, 0.9], scale: [0.95, 1, 0.95] }}
                transition={pulseTransition}
              >
                ლა
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
      <motion.span
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 8 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        className="pointer-events-none absolute left-1/2 top-[112%] -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-900/85 px-3 py-1 text-xs font-medium text-emerald-50 shadow-lg backdrop-blur"
      >
        {label}
      </motion.span>
    </motion.button>
  );
}

export default ChatCloud;
