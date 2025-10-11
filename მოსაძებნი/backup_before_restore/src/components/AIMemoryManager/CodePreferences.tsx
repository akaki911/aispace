import React, { useState } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Code, 
  CheckCircle,
  XCircle 
} from 'lucide-react';

interface CodePreference {
  id: string;
  name: string;
  type: "preferred" | "avoid";
  description: string;
  example?: string;
  category: "general" | "react" | "typescript" | "styling" | "performance";
  isActive: boolean;
}

interface CodePreferencesProps {
  codePreferences: CodePreference[];
  searchTerm: string;
  selectedCategory: string;
  showAddPreference: boolean;
  newPreference: Partial<CodePreference>;
  isLoading: boolean;
  onSetShowAddPreference: (show: boolean) => void;
  onSetNewPreference: React.Dispatch<React.SetStateAction<Partial<CodePreference>>>;
  onAddPreference: () => void;
  onUpdatePreference: (id: string, updates: Partial<CodePreference>) => void;
  onDeletePreference: (id: string) => void;
}

export const CodePreferences: React.FC<CodePreferencesProps> = ({
  codePreferences,
  searchTerm,
  selectedCategory,
  showAddPreference,
  newPreference,
  isLoading,
  onSetShowAddPreference,
  onSetNewPreference,
  onAddPreference,
  onUpdatePreference,
  onDeletePreference
}) => {
  const [editingPreference, setEditingPreference] = useState<string | null>(null);
  const [editPreferenceData, setEditPreferenceData] = useState<Partial<CodePreference>>({});

  const filteredPreferences = codePreferences.filter(pref => {
    const matchesSearch = pref.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         pref.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || pref.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getTypeColor = (type: string) => {
    return type === 'preferred' ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10';
  };

  const getTypeIcon = (type: string) => {
    return type === 'preferred' ? 
      <CheckCircle className="w-4 h-4 text-green-400" /> : 
      <XCircle className="w-4 h-4 text-red-400" />;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'react': return 'bg-blue-500';
      case 'typescript': return 'bg-blue-600';
      case 'styling': return 'bg-purple-500';
      case 'performance': return 'bg-green-500';
      case 'general': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const startEditing = (preference: CodePreference) => {
    setEditingPreference(preference.id);
    setEditPreferenceData(preference);
  };

  const saveEdit = () => {
    if (editingPreference && editPreferenceData) {
      onUpdatePreference(editingPreference, editPreferenceData);
      setEditingPreference(null);
      setEditPreferenceData({});
    }
  };

  const cancelEdit = () => {
    setEditingPreference(null);
    setEditPreferenceData({});
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Code className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">კოდის პრეფერენსები</h3>
        </div>
        <button
          onClick={() => onSetShowAddPreference(!showAddPreference)}
          className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          ახალი პრეფერენსი
        </button>
      </div>

      {showAddPreference && (
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <h4 className="text-white font-medium mb-3">ახალი პრეფერენსის დამატება</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">სახელი</label>
              <input
                type="text"
                value={newPreference.name || ''}
                onChange={(e) => onSetNewPreference({...newPreference, name: e.target.value})}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                placeholder="პრეფერენსის სახელი"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">ტიპი</label>
              <select
                value={newPreference.type || 'preferred'}
                onChange={(e) => onSetNewPreference({...newPreference, type: e.target.value as any})}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
              >
                <option value="preferred">სასურველი</option>
                <option value="avoid">აცილება</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">კატეგორია</label>
              <select
                value={newPreference.category || 'general'}
                onChange={(e) => onSetNewPreference({...newPreference, category: e.target.value as any})}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
              >
                <option value="general">General</option>
                <option value="react">React</option>
                <option value="typescript">TypeScript</option>
                <option value="styling">Styling</option>
                <option value="performance">Performance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">სტატუსი</label>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={newPreference.isActive ?? true}
                  onChange={(e) => onSetNewPreference({...newPreference, isActive: e.target.checked})}
                  className="mr-2"
                />
                <span className="text-white text-sm">აქტიური</span>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-300 mb-1">აღწერა</label>
              <textarea
                value={newPreference.description || ''}
                onChange={(e) => onSetNewPreference({...newPreference, description: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                placeholder="პრეფერენსის დეტალური აღწერა"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-300 mb-1">მაგალითი</label>
              <textarea
                value={newPreference.example || ''}
                onChange={(e) => onSetNewPreference({...newPreference, example: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white font-mono"
                placeholder="კოდის მაგალითი"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button
                onClick={() => onSetShowAddPreference(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
              >
                გაუქმება
              </button>
              <button
                onClick={onAddPreference}
                disabled={isLoading || !newPreference.name}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                <Plus className="w-4 h-4" />
                დამატება
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filteredPreferences.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            პრეფერენსები ვერ მოიძებნა
          </div>
        ) : (
          filteredPreferences.map((preference) => (
            <div
              key={preference.id}
              className={`border-l-4 rounded-lg p-4 ${getTypeColor(preference.type)}`}
            >
              {editingPreference === preference.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editPreferenceData.name || ''}
                    onChange={(e) => setEditPreferenceData({...editPreferenceData, name: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
                  />
                  <textarea
                    value={editPreferenceData.description || ''}
                    onChange={(e) => setEditPreferenceData({...editPreferenceData, description: e.target.value})}
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
                      {getTypeIcon(preference.type)}
                      <span className="text-white font-medium">{preference.name}</span>
                      <span className={`px-2 py-1 ${getCategoryColor(preference.category)} text-white text-xs rounded`}>
                        {preference.category}
                      </span>
                      {preference.isActive && <span className="text-green-400 text-xs">აქტიური</span>}
                    </div>
                    
                    <p className="text-gray-300 text-sm mb-2">{preference.description}</p>
                    
                    {preference.example && (
                      <div className="bg-gray-900 rounded p-3 mb-2">
                        <pre className="text-green-400 text-xs font-mono overflow-x-auto">
                          {preference.example}
                        </pre>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => onUpdatePreference(preference.id, { isActive: !preference.isActive })}
                      className={`p-1 rounded text-xs ${
                        preference.isActive ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-600 hover:bg-gray-500'
                      } text-white transition-colors`}
                    >
                      {preference.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => startEditing(preference)}
                      className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeletePreference(preference.id)}
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