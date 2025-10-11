
import React, { useState } from 'react';
import { LogEntry } from '../useConsoleStream';

interface ExportMenuProps {
  logs: LogEntry[];
  onClose: () => void;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({ logs, onClose }) => {
  const [format, setFormat] = useState<'csv' | 'ndjson'>('csv');
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [includeMeta, setIncludeMeta] = useState(false);

  const exportLogs = () => {
    let content = '';
    let filename = '';
    let mimeType = '';

    if (format === 'csv') {
      // CSV Export
      const headers = ['Timestamp', 'Source', 'Level', 'Message'];
      if (includeMeta) headers.push('Meta');
      
      content = headers.join(',') + '\n';
      
      logs.forEach(log => {
        const row = [
          includeTimestamp ? `"${new Date(log.ts).toISOString()}"` : '',
          `"${log.source}"`,
          `"${log.level}"`,
          `"${log.message.replace(/"/g, '""')}"` // Escape quotes
        ].filter(Boolean);
        
        if (includeMeta && log.meta) {
          row.push(`"${JSON.stringify(log.meta).replace(/"/g, '""')}"`);
        }
        
        content += row.join(',') + '\n';
      });
      
      filename = `console-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
      mimeType = 'text/csv';
      
    } else {
      // NDJSON Export
      logs.forEach(log => {
        const logEntry: any = {
          source: log.source,
          level: log.level,
          message: log.message
        };
        
        if (includeTimestamp) {
          logEntry.timestamp = new Date(log.ts).toISOString();
        }
        
        if (includeMeta && log.meta) {
          logEntry.meta = log.meta;
        }
        
        content += JSON.stringify(logEntry) + '\n';
      });
      
      filename = `console-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.ndjson`;
      mimeType = 'application/x-ndjson';
    }

    // Download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Export Console Logs</h3>
        
        <div className="space-y-4">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Export Format</label>
            <div className="space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={(e) => setFormat(e.target.value as 'csv')}
                  className="mr-2"
                />
                CSV
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  value="ndjson"
                  checked={format === 'ndjson'}
                  onChange={(e) => setFormat(e.target.value as 'ndjson')}
                  className="mr-2"
                />
                NDJSON
              </label>
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="block text-sm font-medium mb-2">Include</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeTimestamp}
                  onChange={(e) => setIncludeTimestamp(e.target.checked)}
                  className="mr-2"
                />
                Timestamp
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeMeta}
                  onChange={(e) => setIncludeMeta(e.target.checked)}
                  className="mr-2"
                />
                Metadata (JSON)
              </label>
            </div>
          </div>

          {/* Stats */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Exporting {logs.length} log entries
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={exportLogs}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
};
