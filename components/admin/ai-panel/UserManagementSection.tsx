import { motion } from 'framer-motion';
import { Download, RefreshCw, Users } from 'lucide-react';
import { cardVariants } from './constants';
import type { ChatLogRecord } from './types';

interface UserManagementSectionProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: 'all' | ChatLogRecord['status'];
  onStatusFilterChange: (value: 'all' | ChatLogRecord['status']) => void;
  filteredLogs: ChatLogRecord[];
  selectedRows: string[];
  onToggleRow: (id: string) => void;
  onExportLogs: () => void;
  onBanUser: (userId: string) => Promise<void>;
  onMuteUser: (userId: string) => void;
}

export function UserManagementSection({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  filteredLogs,
  selectedRows,
  onToggleRow,
  onExportLogs,
  onBanUser,
  onMuteUser,
}: UserManagementSectionProps) {
  return (
    <section id="gurulo-section-userManagement" className="space-y-6 scroll-mt-28">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">მომხმარებლის მართვა</h2>
          <p className="mt-1 text-sm text-[#A0A4AD]">აქტიური სესიების მონიტორინგი და სწრაფი ოპერაციები.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onExportLogs}
            className="inline-flex items-center rounded-full border border-[#7C6CFF3d] bg-[#7C6CFF1f] px-4 py-2 text-sm font-semibold text-[#7C6CFF] transition hover:bg-[#7C6CFF33]"
          >
            <Download className="mr-2 h-4 w-4" />
            ექსპორტი CSV-ში
          </button>
          <button
            onClick={() => onStatusFilterChange('active')}
            className="inline-flex items-center rounded-full border border-[#25D98E3d] bg-[#1E2A27]/80 px-4 py-2 text-sm font-semibold text-[#25D98E] transition hover:bg-[#22342F]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            ნახე აქტიური
          </button>
        </div>
      </div>

      <motion.div variants={cardVariants} initial="hidden" animate="visible" className="glass-elevated p-6 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="მოძებნე სესია ან მომხმარებელი"
                className="w-full rounded-2xl border border-[#7C6CFF33] bg-[#1A1F2F]/80 px-4 py-2 text-sm text-[#E6E8EC] outline-none transition focus:ring-2 focus:ring-[#7C6CFF80]"
              />
              <Users className="absolute right-3 top-2.5 h-4 w-4 text-[#7C6CFF66]" />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value as 'all' | ChatLogRecord['status'])}
              className="rounded-2xl border border-[#7C6CFF33] bg-[#1A1F2F]/80 px-3 py-2 text-sm text-[#E6E8EC] outline-none transition focus:ring-2 focus:ring-[#7C6CFF80]"
            >
              <option value="all">ყველა სტატუსი</option>
              <option value="active">აქტიური</option>
              <option value="archived">არქივირებული</option>
              <option value="flagged">მონიშნული</option>
            </select>
          </div>
          <div className="rounded-2xl border border-[#7C6CFF26] bg-[#181C2A]/70 px-4 py-2 text-xs text-[#A0A4AD]">
            მონიშნული რიგები: {selectedRows.length}
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-[#FFFFFF14]">
          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full divide-y divide-[#FFFFFF1a] text-left text-sm">
              <thead className="bg-[#1A1F2F]/80 text-xs uppercase tracking-[0.2em] text-[#6F7280]">
                <tr>
                  <th className="px-6 py-3">სესია</th>
                  <th className="px-6 py-3">მომხმარებელი</th>
                  <th className="px-6 py-3">მესიჯები</th>
                  <th className="px-6 py-3">სტატუსი</th>
                  <th className="px-6 py-3">დრო</th>
                  <th className="px-6 py-3 text-right">ქმედებები</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#FFFFFF0f]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-[#1F2435]/70">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(log.id)}
                          onChange={() => onToggleRow(log.id)}
                          className="h-4 w-4 rounded border-white/20 bg-transparent text-sky-400 focus:ring-sky-300"
                        />
                        <div>
                          <p className="font-mono text-xs text-[#A0A4AD]">{log.id}</p>
                          <p className="text-[11px] text-[#6F7280]">{new Date(log.startedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-[#7C6CFF]" />
                        <span className="text-sm text-white">{log.userId}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[#6F7280]">
                        {log.keywords.map((keyword) => (
                          <span key={keyword} className="rounded-full border border-[#7C6CFF26] bg-[#181C2A]/70 px-2 py-0.5">
                            #{keyword}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#E6E8EC]">{log.messages}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${statusBadge(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#A0A4AD]">{new Date(log.lastMessageAt).toLocaleTimeString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => onBanUser(log.userId)}
                          className="rounded-full border border-[#E14B8E40] bg-[#2B1428]/80 px-3 py-1 text-xs text-[#E14B8E] transition hover:bg-[#3A1C33]"
                        >
                          ბანი
                        </button>
                        <button
                          onClick={() => onMuteUser(log.userId)}
                          className="rounded-full border border-[#FFC94D40] bg-[#2D2415]/80 px-3 py-1 text-xs text-[#FFC94D] transition hover:bg-[#3A2F1B]"
                        >
                          დუმილი
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function statusBadge(status: ChatLogRecord['status']) {
  switch (status) {
    case 'active':
      return 'border border-[#25D98E40] bg-[#1E2A27]/80 text-[#25D98E]';
    case 'archived':
      return 'border border-[#7C6CFF3d] bg-[#1A1F2F]/80 text-[#7C6CFF]';
    case 'flagged':
      return 'border border-[#E14B8E40] bg-[#2B1428]/80 text-[#E14B8E]';
    default:
      return 'border border-[#7C6CFF26] bg-[#181C2A]/80 text-[#E6E8EC]';
  }
}
