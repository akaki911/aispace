import React, { useState } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  Upload, 
  RefreshCw,
  CheckCircle,
  XCircle 
} from 'lucide-react';

interface SavedRule {
  id: string;
  title: string;
  description: string;
  technicalTip: string;
  isActive: boolean;
  category: "coding" | "ui" | "performance" | "security" | "general";
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
}

interface RulesManagerProps {
  savedRules: SavedRule[];
  searchTerm: string;
  selectedCategory: string;
  showAddRule: boolean;
  newRule: Partial<SavedRule>;
  isLoading: boolean;
  onSetShowAddRule: (show: boolean) => void;
  onSetNewRule: React.Dispatch<React.SetStateAction<Partial<SavedRule>>>;
  onAddRule: () => void;
  onUpdateRule: (id: string, updates: Partial<SavedRule>) => void;
  onDeleteRule: (id: string) => void;
  onExportRules: () => void;
  onImportRules: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const RulesManager: React.FC<RulesManagerProps> = ({
  savedRules,
  searchTerm,
  selectedCategory,
  showAddRule,
  newRule,
  isLoading,
  onSetShowAddRule,
  onSetNewRule,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onExportRules,
  onImportRules
}) => {
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editRuleData, setEditRuleData] = useState<Partial<SavedRule>>({});

  const filteredRules = savedRules.filter(rule => {
    const matchesSearch = rule.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || rule.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'coding': return 'bg-blue-500';
      case 'ui': return 'bg-purple-500';
      case 'performance': return 'bg-green-500';
      case 'security': return 'bg-red-500';
      case 'general': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const startEditing = (rule: SavedRule) => {
    setEditingRule(rule.id);
    setEditRuleData(rule);
  };

  const saveEdit = () => {
    if (editingRule && editRuleData) {
      onUpdateRule(editingRule, editRuleData);
      setEditingRule(null);
      setEditRuleData({});
    }
  };

  const cancelEdit = () => {
    setEditingRule(null);
    setEditRuleData({});
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">შენახული წესები</h3>
        <div className="flex gap-2">
          <button
            onClick={onExportRules}
            className="flex items-center gap-2 px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <label className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            Import
            <input
              type="file"
              accept=".json"
              onChange={onImportRules}
              className="hidden"
            />
          </label>
          <button
            onClick={() => onSetShowAddRule(!showAddRule)}
            className="flex items-center gap-2 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            ახალი წესი
          </button>
        </div>
      </div>

      {showAddRule && (
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <h4 className="text-white font-medium mb-3">ახალი წესის დამატება</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">სათაური</label>
              <input
                type="text"
                value={newRule.title || ''}
                onChange={(e) => onSetNewRule({...newRule, title: e.target.value})}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                placeholder="წესის სათაური"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">კატეგორია</label>
              <select
                value={newRule.category || 'general'}
                onChange={(e) => onSetNewRule({...newRule, category: e.target.value as any})}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
              >
                <option value="general">General</option>
                <option value="coding">Coding</option>
                <option value="ui">UI</option>
                <option value="performance">Performance</option>
                <option value="security">Security</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-300 mb-1">აღწერა</label>
              <textarea
                value={newRule.description || ''}
                onChange={(e) => onSetNewRule({...newRule, description: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                placeholder="წესის დეტალური აღწერა"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-300 mb-1">ტექნიკური რჩევა</label>
              <textarea
                value={newRule.technicalTip || ''}
                onChange={(e) => onSetNewRule({...newRule, technicalTip: e.target.value})}
                rows={2}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                placeholder="ტექნიკური დეტალები და მაგალითები"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button
                onClick={() => onSetShowAddRule(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
              >
                გაუქმება
              </button>
              <button
                onClick={onAddRule}
                disabled={isLoading || !newRule.title}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                დამატება
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filteredRules.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            წესები ვერ მოიძებნა
          </div>
        ) : (
          filteredRules.map((rule) => (
            <div key={rule.id} className="bg-gray-700 rounded-lg p-4">
              {editingRule === rule.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editRuleData.title || ''}
                    onChange={(e) => setEditRuleData({...editRuleData, title: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                  />
                  <textarea
                    value={editRuleData.description || ''}
                    onChange={(e) => setEditRuleData({...editRuleData, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
                    >
                      გაუქმება
                    </button>
                    <button
                      onClick={saveEdit}
                      className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm"
                    >
                      შენახვა
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 ${getCategoryColor(rule.category)} text-white text-xs rounded`}>
                        {rule.category}
                      </span>
                      <span className="text-white font-medium">{rule.title}</span>
                      {rule.isActive ? 
                        <CheckCircle className="w-4 h-4 text-green-400" /> : 
                        <XCircle className="w-4 h-4 text-gray-400" />
                      }
                    </div>
                    <p className="text-gray-300 text-sm mb-2">{rule.description}</p>
                    {rule.technicalTip && (
                      <p className="text-gray-400 text-xs bg-gray-800 p-2 rounded">
                        💡 {rule.technicalTip}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => onUpdateRule(rule.id, { isActive: !rule.isActive })}
                      className={`p-1 rounded text-sm ${
                        rule.isActive ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'
                      } text-white transition-colors`}
                    >
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => startEditing(rule)}
                      className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteRule(rule.id)}
                      className="p-1 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};