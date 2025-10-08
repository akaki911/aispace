
import { useState } from 'react';

export const useUIState = () => {
  const [activeTab, setActiveTab] = useState<
    "explorer" | "chat" | "console" | "memory" | "logs" | "settings" | "github" | "backup" | "auto-improve"
  >("chat");
  
  const [autoImproveSubTab, setAutoImproveSubTab] = useState<
    "monitoring" | "live-agent" | "overview" | "proposals" | "metrics" | "settings"
  >("monitoring");

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showOnlyLatest, setShowOnlyLatest] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  return {
    activeTab,
    setActiveTab,
    autoImproveSubTab,
    setAutoImproveSubTab,
    isDarkMode,
    setIsDarkMode,
    showOnlyLatest,
    setShowOnlyLatest,
    autoScroll,
    setAutoScroll
  };
};
