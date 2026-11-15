import React from 'react';
import { Mail, ArrowLeft, Sparkles } from 'lucide-react';

interface EmailTemplatesPageProps {
  onBackToDashboard: () => void;
}

export function EmailTemplatesPage({ onBackToDashboard }: EmailTemplatesPageProps) {
  return (
    <div className="min-h-[68vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm max-w-md w-full p-8 sm:p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-50 border border-violet-100 text-[#6D28D9] flex items-center justify-center mx-auto mb-5 relative">
          <Mail className="w-8 h-8" />
          <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#6D28D9] text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
        </div>

        <h2 className="text-xl font-bold text-slate-900">Email Templates</h2>
        <div className="inline-block mt-2 px-3 py-1 rounded-lg bg-violet-50 text-[#6D28D9] text-xs font-semibold border border-violet-200/70">
          Coming Soon
        </div>

        <p className="text-sm text-slate-500 mt-4 leading-relaxed">
          Email template management is currently under development.
        </p>

        <button
          type="button"
          onClick={onBackToDashboard}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-sm font-semibold transition-colors shadow-sm whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>
    </div>
  );
}
