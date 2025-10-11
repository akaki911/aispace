import React from 'react';
import { TrendingUp, Activity, Archive, Shield } from 'lucide-react';

interface MemoryStats {
  totalRules: number;
  activeRules: number;
  resolvedErrors: number;
  totalActions: number;
  accuracyRate: number;
  memoryUsage: number;
}

interface StatsViewerProps {
  stats: MemoryStats;
}

export const StatsViewer: React.FC<StatsViewerProps> = ({ stats }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-green-400" />
        <h3 className="text-lg font-semibold text-white">სტატისტიკა</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-300">წესები</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalRules}</div>
          <div className="text-xs text-gray-400">ფენალეები: {stats.activeRules}</div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-red-400" />
            <span className="text-sm text-gray-300">შეცდომები</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.resolvedErrors}</div>
          <div className="text-xs text-gray-400">გადაწყვეტილი</div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Archive className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-gray-300">მოქმედებები</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalActions}</div>
          <div className="text-xs text-gray-400">სულ</div>
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-300">ზუსტობა</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.accuracyRate}%</div>
          <div className="text-xs text-gray-400">გაუმჯობესება</div>
        </div>
      </div>

      <div className="mt-4 bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-300">მეხსიერების გამოყენება</span>
          <span className="text-sm text-white">{stats.memoryUsage.toFixed(2)} MB</span>
        </div>
        <div className="w-full bg-gray-600 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full"
            style={{ width: `${Math.min((stats.memoryUsage / 10) * 100, 100)}%` }}
          ></div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          ოპტიმალური დიაპაზონი: 0-10 MB
        </div>
      </div>
    </div>
  );
};