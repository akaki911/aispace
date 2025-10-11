import { motion } from 'framer-motion';
import { cardVariants } from './constants';
import { UserManagementSection } from './UserManagementSection';
import type { ChatLogRecord } from './types';

type StatusFilter = 'all' | ChatLogRecord['status'];

interface UsersPanelProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  filteredLogs: ChatLogRecord[];
  selectedRows: string[];
  onToggleRow: (id: string) => void;
  onExportLogs: () => void;
  onBanUser: (userId: string) => void;
  onMuteUser: (userId: string) => void;
  onArchiveCleanup: () => void;
  onSimulateUsage: () => void;
  onSimulateSessionLength: () => void;
}

export function UsersPanel({
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
  onArchiveCleanup,
  onSimulateUsage,
  onSimulateSessionLength,
}: UsersPanelProps) {
  const hasSelectedRows = selectedRows.length > 0;
  const ensurePromise = (fn: (userId: string) => void | Promise<void>) => async (userId: string) => {
    await Promise.resolve(fn(userId));
  };

  return (
    <div className="space-y-6">
      <UserManagementSection
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        filteredLogs={filteredLogs}
        selectedRows={selectedRows}
        onToggleRow={onToggleRow}
        onExportLogs={onExportLogs}
        onBanUser={ensurePromise(onBanUser)}
        onMuteUser={onMuteUser}
      />

      <motion.section
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="glass-elevated p-6 text-white"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-2xl font-semibold">სესიების არქივაცია</h3>
            <p className="text-sm text-[#A0A4AD]">მონიშნული ჩანაწერები შეიძლება ჩაიწეროს ადგილობრივ არქივში ან წაიშალოს.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onArchiveCleanup}
              className="inline-flex items-center rounded-full border border-[#7C6CFF3d] bg-[#1A1F2F]/80 px-4 py-2 text-sm font-semibold text-[#E6E8EC] transition hover:bg-[#242B3F]"
              disabled={!hasSelectedRows}
            >
              მონიშნულის გასუფთავება
            </button>
            <button
              onClick={onSimulateUsage}
              className="inline-flex items-center rounded-full border border-[#25D98E3d] bg-[#25D98E1f] px-4 py-2 text-sm font-semibold text-[#25D98E] transition hover:bg-[#25D98E33]"
            >
              სიმულაცია · გამოყენება
            </button>
            <button
              onClick={onSimulateSessionLength}
              className="inline-flex items-center rounded-full border border-[#FFC94D40] bg-[#2D2415]/80 px-4 py-2 text-sm font-semibold text-[#FFC94D] transition hover:bg-[#3A2F1B]"
            >
              სიმულაცია · სესიის დრო
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
