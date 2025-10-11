// SOL-208 Refactored: AIMemoryManager split into modular components
// Original file: 2526 LOC → New: <200 LOC (wrapper only)
// UI FREEZE: Exact same visual appearance, zero layout changes
// All logic moved to: hooks/memory/* and components/AIMemoryManager/*

import React from "react";
import AIMemoryManagerIndex from "./AIMemoryManager/index";

// Simple wrapper that maintains backward compatibility
// All functionality now handled by modular components
const AIMemoryManager: React.FC = () => {
  return <AIMemoryManagerIndex />;
};

export default AIMemoryManager;