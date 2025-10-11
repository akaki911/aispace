import React from 'react';
import { Edit, Save, X, User, Languages } from 'lucide-react';

interface PersonalInfo {
  name: string;
  age: string;
  interests: string;
  notes: string;
  preferredLanguage: "ka" | "en";
  role: "developer" | "designer" | "manager";
  programmingLanguages: string[];
  codeStyle: string;
  currentProject: string;
  openFiles: string[];
}

interface PersonalInfoEditorProps {
  personalInfo: PersonalInfo;
  editData: PersonalInfo;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  setEditData: React.Dispatch<React.SetStateAction<PersonalInfo>>;
  onSave: () => void;
}

export const PersonalInfoEditor: React.FC<PersonalInfoEditorProps> = ({
  personalInfo,
  editData,
  isEditing,
  setIsEditing,
  setEditData,
  onSave
}) => {
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">პირადი ინფორმაცია</h3>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition-colors"
          >
            <Edit className="w-4 h-4" />
            რედაქტირება
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="flex items-center gap-2 px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm transition-colors"
            >
              <Save className="w-4 h-4" />
              შენახვა
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditData(personalInfo);
              }}
              className="flex items-center gap-2 px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded-md text-sm transition-colors"
            >
              <X className="w-4 h-4" />
              გაუქმება
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            სახელი
          </label>
          {isEditing ? (
            <input
              type="text"
              value={editData.name}
              onChange={(e) =>
                setEditData({ ...editData, name: e.target.value })
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-gray-100">{personalInfo.name || "მითითებული არ არის"}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            ასაკი
          </label>
          {isEditing ? (
            <input
              type="text"
              value={editData.age}
              onChange={(e) =>
                setEditData({ ...editData, age: e.target.value })
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-gray-100">{personalInfo.age || "მითითებული არ არის"}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Languages className="w-4 h-4 inline mr-1" />
            სასურველი ენა
          </label>
          {isEditing ? (
            <select
              value={editData.preferredLanguage}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  preferredLanguage: e.target.value as "ka" | "en",
                })
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ka">ქართული</option>
              <option value="en">English</option>
            </select>
          ) : (
            <p className="text-gray-100">
              {personalInfo.preferredLanguage === "ka" ? "ქართული" : "English"}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            როლი
          </label>
          {isEditing ? (
            <select
              value={editData.role}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  role: e.target.value as "developer" | "designer" | "manager",
                })
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="developer">დეველოპერი</option>
              <option value="designer">დიზაინერი</option>
              <option value="manager">მენეჯერი</option>
            </select>
          ) : (
            <p className="text-gray-100">
              {personalInfo.role === "developer"
                ? "დეველოპერი"
                : personalInfo.role === "designer"
                ? "დიზაინერი"
                : "მენეჯერი"}
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            ინტერესები
          </label>
          {isEditing ? (
            <textarea
              value={editData.interests}
              onChange={(e) =>
                setEditData({ ...editData, interests: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-gray-100">{personalInfo.interests || "მითითებული არ არის"}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            შენიშვნები
          </label>
          {isEditing ? (
            <textarea
              value={editData.notes}
              onChange={(e) =>
                setEditData({ ...editData, notes: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-gray-100">{personalInfo.notes || "მითითებული არ არის"}</p>
          )}
        </div>
      </div>
    </div>
  );
};