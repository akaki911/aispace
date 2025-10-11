import React, { useState, useEffect } from 'react';

export const SettingsMenu: React.FC = () => {
  const [autoApplyAIChanges, setAutoApplyAIChanges] = useState(
    localStorage.getItem('autoApplyAIChanges') === 'true'
  );

  const handleAutoApplyToggle = (isChecked: boolean) => {
    setAutoApplyAIChanges(isChecked);
    localStorage.setItem('autoApplyAIChanges', isChecked.toString());
  };

  return (
    <div className="p-4 border rounded-lg bg-white">
      <h3 className="font-semibold mb-3">Settings</h3>

      <div className="space-y-4">
          {/* Auto-apply AI changes setting */}
          <div className="flex items-center justify-between">
            <label htmlFor="auto-apply-changes" className="text-sm font-medium">
              Auto-apply AI changes
            </label>
            <input
              id="auto-apply-changes"
              type="checkbox"
              checked={autoApplyAIChanges}
              onChange={(e) => handleAutoApplyToggle(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          {/* Existing settings */}
      </div>
    </div>
  );
};