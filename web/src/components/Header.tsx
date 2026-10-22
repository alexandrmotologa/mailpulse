import React, { useState } from 'react';
import { 
  Inbox, 
  Trash2, 
  Send, 
  Sun, 
  Moon, 
  Webhook as WebhookIcon, 
  ChevronDown, 
  ShieldAlert, 
  FileText, 
  Key, 
  Receipt,
  Flame,
  Archive,
  Keyboard
} from 'lucide-react';
import { ServerStats } from '../types';

interface HeaderProps {
  stats: ServerStats | null;
  isConnected: boolean;
  isDarkMode: boolean;
  isChaosEnabled?: boolean;
  onToggleTheme: () => void;
  onClearAll: () => void;
  onSendSample: (template: string) => Promise<void>;
  onOpenWebhookModal: () => void;
  onOpenChaosModal: () => void;
  onOpenShortcutsModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  isConnected,
  isDarkMode,
  isChaosEnabled = false,
  onToggleTheme,
  onClearAll,
  onSendSample,
  onOpenWebhookModal,
  onOpenChaosModal,
  onOpenShortcutsModal,
}) => {
  const [isSampleOpen, setIsSampleOpen] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const sampleTemplates = [
    { id: 'otp', name: 'OTP Verification Code', desc: 'Numeric 6-digit PIN with expiration', icon: Key },
    { id: 'reset', name: 'Password Reset', desc: 'Magic login link with token parameters', icon: FileText },
    { id: 'receipt', name: 'Order Receipt', desc: 'E-commerce table with inline CID image', icon: Receipt },
    { id: 'spam', name: 'Spam Promotion', desc: 'ALL CAPS, trigger words & missing headers', icon: ShieldAlert },
    { id: 'alert', name: 'Security Alert', desc: 'New device sign-in notification', icon: ShieldAlert },
  ];

  const handleSelectSample = async (templateId: string) => {
    setSendingTemplate(templateId);
    try {
      await onSendSample(templateId);
    } finally {
      setSendingTemplate(null);
      setIsSampleOpen(false);
    }
  };

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between z-20 shrink-0">
      {/* Brand & Connection Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
            <Inbox className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
              MailPulse
            </span>
            <span className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400">
              v1.0
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:border-slate-800 mx-1 hidden sm:block" />

        {/* SMTP Port Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
          <span className="relative flex h-2 w-2">
            {isConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            )}
          </span>
          <span>SMTP :{stats?.smtpPort || 1025}</span>
        </div>

        {/* Chaos Active Indicator Pill */}
        {isChaosEnabled && (
          <button
            onClick={onOpenChaosModal}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 transition-colors animate-pulse"
            title="Chaos Simulator is actively injecting SMTP latency or faults"
          >
            <Flame className="w-3 h-3" />
            <span>Chaos Active</span>
          </button>
        )}

        {/* Total Count Badge */}
        {stats && stats.totalMessages > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:inline">
            {stats.totalMessages} {stats.totalMessages === 1 ? 'email' : 'emails'}
          </span>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5">
        {/* Send Sample Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsSampleOpen(!isSampleOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/80 transition-colors shadow-2xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send Sample</span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          {isSampleOpen && (
            <>
              <div 
                className="fixed inset-0 z-30" 
                onClick={() => setIsSampleOpen(false)} 
              />
              <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-40">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Test Email Templates
                </div>
                {sampleTemplates.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleSelectSample(t.id)}
                      disabled={sendingTemplate !== null}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/70 flex items-start gap-2.5 transition-colors"
                    >
                      <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          {t.name}
                          {sendingTemplate === t.id && (
                            <span className="text-[10px] text-indigo-600 animate-pulse">Sending...</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Chaos Simulator Trigger */}
        <button
          onClick={onOpenChaosModal}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isChaosEnabled
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
              : 'text-slate-700 dark:text-slate-300 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Configure SMTP Chaos & Artificial Latency"
        >
          <Flame className="w-3.5 h-3.5 text-amber-500" />
          <span className="hidden xl:inline">Chaos</span>
        </button>

        {/* Export All Messages as ZIP */}
        <a
          href="/api/export-zip"
          download="mailpulse-export.zip"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Export all messages, raw EMLs and attachments as a single ZIP archive"
        >
          <Archive className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Export ZIP</span>
        </a>

        {/* Webhooks Trigger */}
        <button
          onClick={onOpenWebhookModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Configure Local Webhook Forwarding"
        >
          <WebhookIcon className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Webhooks</span>
        </button>

        {/* Clear All Button */}
        {stats && stats.totalMessages > 0 && (
          <div className="relative">
            {showClearConfirm ? (
              <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/50 p-0.5 rounded-lg border border-red-200 dark:border-red-900">
                <button
                  onClick={() => {
                    onClearAll();
                    setShowClearConfirm(false);
                  }}
                  className="px-2 py-1 text-xs font-semibold bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Confirm Clear
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                title="Clear all messages"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Keyboard Shortcuts Trigger */}
        <button
          onClick={onOpenShortcutsModal}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
