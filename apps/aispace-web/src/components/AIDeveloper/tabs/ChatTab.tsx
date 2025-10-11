
import React from 'react';
import ReplitAssistantPanel from '@/components/ReplitAssistantPanel';

interface ChatTabProps {
  isAuthenticated: boolean;
  userRole: string;
}

const ChatTab: React.FC<ChatTabProps> = ({ isAuthenticated, userRole }) => {
  if (!isAuthenticated) {
    return (
      <div className="h-full bg-gradient-to-br from-[#0E1116] via-[#1A1533] to-[#2C214E] text-[#E6E8EC] flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl px-10 py-12 text-center shadow-[0_28px_60px_rgba(8,10,26,0.6)]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-[#121622]/80 shadow-[0_16px_36px_rgba(60,32,128,0.35)]">
            <span className="text-2xl">🔐</span>
          </div>
          <div className="text-lg font-semibold tracking-wide">ავთენტიფიკაცია საჭიროა</div>
          <div className="mt-2 text-sm text-[#A0A4AD]">
            გთხოვთ, გაიარეთ ავტორიზაცია AI ჩატის გამოსაყენებლად
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-[#0E1116]/90 via-[#1A1533]/90 to-[#351D6A]/90 text-[#E6E8EC]">
      <div className="h-full px-6 pb-6 pt-4">
        <div className="h-full rounded-3xl border border-white/10 bg-[#0F1320]/80 backdrop-blur-2xl shadow-[0_35px_80px_rgba(5,10,30,0.55)]">
          <ReplitAssistantPanel />
        </div>
      </div>
    </div>
  );
};

export default ChatTab;
