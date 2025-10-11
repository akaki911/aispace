import React, { useState, useRef } from 'react';
import { useAttachments } from '../../hooks/useAttachments';

// Assuming ComposerProps and other necessary types/interfaces are defined elsewhere
interface ComposerProps {
  onSend: (message: string, attachments: any[]) => void; // Updated to include attachments
  disabled: boolean;
}

const Composer: React.FC<ComposerProps> = ({ onSend, disabled }) => {
  const [message, setMessage] = useState('');
  const { attachments, uploading, uploadFiles, removeAttachment, clearAttachments } = useAttachments();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (message.trim()) {
      onSend(message.trim(), attachments);
      setMessage('');
      clearAttachments();
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      try {
        await uploadFiles(files);
      } catch (error) {
        console.error('File upload failed:', error);
      }
    }
  };

  return (
    <div className="border-t p-4">
      {/* File attachments display */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-sm">
              <span className="truncate max-w-32">{attachment.name}</span>
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          accept="text/*,application/json,application/javascript,application/typescript,image/*"
        />

        {/* Paperclip button */}
        <button
          onClick={handleFileSelect}
          disabled={disabled || uploading}
          className="px-3 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          title="Attach files"
        >
          📎
        </button>

        <textarea
          className="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white dark:border-gray-600"
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={disabled || uploading}
        />
        <button
          onClick={handleSend}
          disabled={disabled || uploading || (!message.trim() && attachments.length === 0)}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Composer;