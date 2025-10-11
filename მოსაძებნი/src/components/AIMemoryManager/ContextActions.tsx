import React from 'react';
import { 
  Play, 
  Calendar, 
  Archive, 
  FileText,
  Code,
  Share2
} from 'lucide-react';

interface ContextAction {
  id: string;
  title: string;
  description: string;
  category: "file" | "rule" | "error" | "chat" | "system";
  action: string;
  timestamp: Date;
  isExecuted: boolean;
  result?: string;
}

interface ContextActionsProps {
  contextActions: ContextAction[];
  onRunAction: (actionId: string) => void;
  onClearActions: () => void;
}

export const ContextActions: React.FC<ContextActionsProps> = ({
  contextActions,
  onRunAction,
  onClearActions
}) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'file': return <FileText className="w-4 h-4 text-blue-400" />;
      case 'rule': return <Code className="w-4 h-4 text-purple-400" />;
      case 'error': return <Archive className="w-4 h-4 text-red-400" />;
      case 'chat': return <Share2 className="w-4 h-4 text-green-400" />;
      case 'system': return <Calendar className="w-4 h-4 text-yellow-400" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'file': return 'border-blue-500 bg-blue-500/10';
      case 'rule': return 'border-purple-500 bg-purple-500/10';
      case 'error': return 'border-red-500 bg-red-500/10';
      case 'chat': return 'border-green-500 bg-green-500/10';
      case 'system': return 'border-yellow-500 bg-yellow-500/10';
      default: return 'border-gray-500 bg-gray-500/10';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">კონტექსტური მოქმედებები</h3>
        <button
          onClick={onClearActions}
          className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-sm transition-colors"
        >
          ყველას გაწმენდა
        </button>
      </div>

      <div className="space-y-3">
        {contextActions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            მოქმედებები ვერ მოიძებნა
          </div>
        ) : (
          contextActions.map((action) => (
            <div
              key={action.id}
              className={`border-l-4 rounded-lg p-4 ${getCategoryColor(action.category)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getCategoryIcon(action.category)}
                    <span className="text-white font-medium">{action.title}</span>
                    <span className="text-xs text-gray-400 capitalize">
                      {action.category}
                    </span>
                  </div>
                  
                  <p className="text-gray-300 text-sm mb-2">{action.description}</p>
                  
                  <div className="bg-gray-900 rounded p-2 mb-2">
                    <code className="text-green-400 text-xs font-mono">
                      {action.action}
                    </code>
                  </div>

                  {action.result && (
                    <div className="bg-gray-700 rounded p-2 mb-2">
                      <p className="text-gray-300 text-xs">
                        <strong>შედეგი:</strong> {action.result}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>📅 {action.timestamp.toLocaleString()}</span>
                    <span className={action.isExecuted ? 'text-green-400' : 'text-yellow-400'}>
                      {action.isExecuted ? '✅ შესრულებული' : '⏳ მოლოდინში'}
                    </span>
                  </div>
                </div>

                <div className="ml-4">
                  <button
                    onClick={() => onRunAction(action.id)}
                    disabled={action.isExecuted}
                    className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                      action.isExecuted
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    <Play className="w-4 h-4" />
                    {action.isExecuted ? 'შესრულებული' : 'გაშვება'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {contextActions.length > 0 && (
        <div className="mt-4 text-sm text-gray-400">
          სულ: {contextActions.length} მოქმედება, 
          შესრულებული: {contextActions.filter(a => a.isExecuted).length}
        </div>
      )}
    </div>
  );
};