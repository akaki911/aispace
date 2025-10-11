import React, { useState } from 'react';
import { feedbackApi } from '../../services/feedbackApi';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  regenerated?: boolean;
}

interface MessageProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
}

const Message: React.FC<MessageProps> = ({ message, onRegenerate }) => {
  const [showActions, setShowActions] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      console.log('Message copied to clipboard');
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate(message.id);
    }
  };

  const handleThumbsUp = async () => {
    try {
      await feedbackApi.sendFeedback({ messageId: message.id, up: true });
    } catch (error) {
      console.warn('Feedback failed:', error);
    }
  };

  const handleThumbsDown = async () => {
    try {
      await feedbackApi.sendFeedback({ messageId: message.id, up: false });
    } catch (error) {
      console.warn('Feedback failed:', error);
    }
  };

  return (
    <div 
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4 group`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="relative">
        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          message.role === 'user' 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-white'
        }`}>
          <div>{message.text}</div>
          {message.regenerated && (
            <div className="text-xs opacity-75 mt-1">🔄 regenerated</div>
          )}
        </div>

        {/* Message Actions Bar */}
        {showActions && (
          <div className="absolute top-0 right-0 transform translate-x-full -translate-y-1 flex gap-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg px-2 py-1">
            <button
              onClick={handleCopy}
              className="p-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-sm"
              title="Copy message"
            >
              📋
            </button>

            {message.role === 'assistant' && (
              <>
                <button
                  onClick={handleRegenerate}
                  className="p-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-sm"
                  title="Regenerate"
                >
                  🔄
                </button>
                <button
                  onClick={handleThumbsUp}
                  className="p-1 text-gray-600 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 text-sm"
                  title="Thumbs up"
                >
                  👍
                </button>
                <button
                  onClick={handleThumbsDown}
                  className="p-1 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 text-sm"
                  title="Thumbs down"
                >
                  👎
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;