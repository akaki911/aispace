// @ts-nocheck
import React, { useState } from 'react';

export interface DiffItem {
  path: string;
  content?: string;
  before?: string;
  after?: string;
  unified?: string;
}

interface DiffCardProps {
  item: DiffItem;
  onApply: (path: string, content: string) => void;
}

export const DiffCard: React.FC<DiffCardProps> = ({ item, onApply }) => {
  const [open, setOpen] = useState(true);
  const [applying, setApplying] = useState(false);
  const content = item.after ?? item.content ?? '';

  const handleApply = async () => {
    setApplying(true);
    try {
      const response = await fetch('/api/files/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          path: item.path,
          content: content
        })
      });

      const result = await response.json();
      if (result.ok) {
        onApply(item.path, content);
      } else {
        throw new Error(result.error || 'Apply failed');
      }
    } catch (error) {
      console.error('Apply failed:', error);
      alert(`Failed to apply changes to ${item.path}: ${error.message}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="rounded-xl border p-3 mb-3 bg-white dark:bg-gray-800">
      <div className="flex justify-between items-center">
        <strong className="truncate text-sm font-mono">{item.path}</strong>
        <div className="flex gap-2">
          <button 
            onClick={handleApply}
            disabled={applying}
            className="px-3 py-1 rounded-md border bg-green-50 hover:bg-green-100 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-300 text-sm disabled:opacity-50"
          >
            {applying ? 'Applying...' : 'Apply'}
          </button>
          <button 
            onClick={() => setOpen(!open)}
            className="px-3 py-1 rounded-md border bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm"
          >
            {open ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      {open && (
        <pre className="mt-2 overflow-auto text-sm bg-gray-50 dark:bg-gray-900 p-2 rounded">
          <code>{item.unified ?? content}</code>
        </pre>
      )}
    </div>
  );
};