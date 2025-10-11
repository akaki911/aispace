
export const devConsoleUIFixes = [
  {
    id: "stream-offline-indicator",
    title: "Auto-disable Live Toggle When Offline",
    prompt: "When Data Stream is offline, automatically disable the 'Live' indicator and show a reconnect button with tooltip.",
    priority: "high",
    component: "LiveMetrics"
  },
  {
    id: "log-meta-spacing",
    title: "Fix Log Meta Expand/Collapse UI",
    prompt: "Fix alignment and spacing between 'Show Meta' and log text blocks. Add indentation and visual toggle indicators for expanded logs.",
    priority: "high",
    component: "LogLine"
  },
  {
    id: "log-timestamp-date",
    title: "Add Date Prefix to Timestamps",
    prompt: "Add date prefix (e.g., 2025-08-23) to log timestamps when 'All Time' filter is selected.",
    priority: "medium",
    component: "LogLine"
  },
  {
    id: "debounce-404-logs",
    title: "Prevent 404 Log Spam",
    prompt: "Add debounce to repetitive identical 404 logs within 10 seconds to prevent console spam.",
    priority: "medium",
    component: "useConsoleStream"
  },
  {
    id: "silence-known-404s",
    title: "Silence Known Static 404 Routes",
    prompt: "Silence known static 404 routes from frontend probing unless debug mode is on.",
    priority: "low",
    component: "Backend"
  },
  {
    id: "pin-icon-improvement",
    title: "Improve Pin Icon UX",
    prompt: "Replace the pin icon for pinned logs with a bookmark icon and tooltip 'Pin this log'.",
    priority: "low",
    component: "LogLine"
  }
];

export const getPromptById = (id: string) => {
  return devConsoleUIFixes.find(fix => fix.id === id);
};

export const getPromptsByPriority = (priority: "high" | "medium" | "low") => {
  return devConsoleUIFixes.filter(fix => fix.priority === priority);
};

export const getPromptsByComponent = (component: string) => {
  return devConsoleUIFixes.filter(fix => fix.component === component);
};
