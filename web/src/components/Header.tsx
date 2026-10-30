import React, { useState, useRef, useEffect } from 'react';
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
  Keyboard,
  MoreHorizontal
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
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const sampleDropdownRef = useRef<HTMLDivElement>(null);
  const moreDropdownRef = useRef<HTMLDivElement>(null);
  const clearConfirmRef = useRef<HTMLDivElement>(null);

  const sampleTemplates = [
    { id: 'otp', name: 'OTP Verification Code', desc: 'Numeric 6-digit PIN with expiration', icon: Key },
    { id: 'reset', name: 'Password Reset', desc: 'Magic login link with token parameters', icon: FileText },
    { id: 'receipt', name: 'Order Receipt', desc: 'E-commerce table with inline CID image', icon: Receipt },
    { id: 'spam', name: 'Spam Promotion', desc: 'ALL CAPS, trigger words & missing headers', icon: ShieldAlert },
    { id: 'alert', name: 'Security Alert', desc: 'New device sign-in notification', icon: ShieldAlert },
  ];

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (sampleDropdownRef.current && !sampleDropdownRef.current.contains(target)) {
        setIsSampleOpen(false);
      }
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(target)) {
        setIsMoreOpen(false);
      }
      if (clearConfirmRef.current && !clearConfirmRef.current.contains(target)) {
        setShowClearConfirm(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <header className="h-14 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Brand & Connection Status */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-xs shadow-indigo-500/25">
            <Inbox className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white">
              MailPulse
            </span>
            <span className="text-[11px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded-md">
              v1.0
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5 hidden sm:block shrink-0" />

        {/* SMTP Port Badge */}
        <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60 shrink-0">
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
          <span className="hidden sm:inline">SMTP</span>
          <span>:{stats?.smtpPort || 1025}</span>
        </div>

        {/* Chaos Active Indicator Pill */}
        {isChaosEnabled && (
          <button
            onClick={onOpenChaosModal}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 transition-colors animate-pulse shrink-0"
            title="Chaos Simulator is actively injecting SMTP latency or faults"
          >
            <Flame className="w-3 h-3 text-amber-500" />
            <span className="hidden md:inline">Chaos Active</span>
          </button>
        )}

        {/* Total Count Badge */}
        {stats && stats.totalMessages > 0 && (
          <span className="text-xs text-slate-400 dark:text-slate-500 hidden xl:inline font-mono shrink-0">
            {stats.totalMessages} {stats.totalMessages === 1 ? 'msg' : 'msgs'}
          </span>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Send Sample Dropdown */}
        <div className="relative shrink-0" ref={sampleDropdownRef}>
          <button
            onClick={() => setIsSampleOpen(!isSampleOpen)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-xs shadow-indigo-600/20 whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send Sample</span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isSampleOpen ? 'rotate-180' : ''}`} />
          </button>

          {isSampleOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3.5 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Generate Sample Scenarios
              </div>
              <div className="space-y-0.5 px-1.5">
                {sampleTemplates.map((t) => {
                  const Icon = t.icon;
                  const isSending = sendingTemplate === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleSelectSample(t.id)}
                      disabled={sendingTemplate !== null}
                      className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-start gap-3 transition-colors disabled:opacity-50"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between gap-1">
                          <span className="truncate">{t.name}</span>
                          {isSending && (
                            <span className="text-[10px] font-mono text-indigo-600 animate-pulse shrink-0">Sending...</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{t.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Desktop Buttons Toolbar (Visible on tablet & desktop) */}
        <div className="hidden md:flex items-center gap-1">
          {/* Chaos Simulator Trigger */}
          <button
            onClick={onOpenChaosModal}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
              isChaosEnabled
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                : 'text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
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
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            title="Export all messages, raw EMLs and attachments as a single ZIP archive"
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Export ZIP</span>
          </a>

          {/* Webhooks Trigger */}
          <button
            onClick={onOpenWebhookModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            title="Configure Local Webhook Forwarding"
          >
            <WebhookIcon className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Webhooks</span>
          </button>
        </div>

        {/* Clear All Button with Safe Floating Popover */}
        {stats && stats.totalMessages > 0 && (
          <div className="relative shrink-0" ref={clearConfirmRef}>
            <button
              onClick={() => setShowClearConfirm(!showClearConfirm)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title="Clear all messages"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {showClearConfirm && (
              <div className="absolute right-0 mt-2 w-56 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
                <div className="font-semibold text-slate-900 dark:text-white mb-1">Clear all emails?</div>
                <div className="text-slate-500 dark:text-slate-400 text-[11px] mb-3">This permanently purges {stats.totalMessages} captured messages from the mailbox.</div>
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onClearAll();
                      setShowClearConfirm(false);
                    }}
                    className="px-2.5 py-1 rounded-lg font-semibold bg-rose-600 text-white hover:bg-rose-500 transition-colors shadow-xs"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mobile/Compact "More" Menu for auxiliary actions */}
        <div className="relative md:hidden shrink-0" ref={moreDropdownRef}>
          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="More actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMoreOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
              <button
                onClick={() => {
                  onOpenChaosModal();
                  setIsMoreOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-slate-700 dark:text-slate-200"
              >
                <Flame className="w-4 h-4 text-amber-500" />
                <span>SMTP Chaos Lab</span>
              </button>
              <button
                onClick={() => {
                  onOpenWebhookModal();
                  setIsMoreOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-slate-700 dark:text-slate-200"
              >
                <WebhookIcon className="w-4 h-4 text-indigo-500" />
                <span>Webhooks Forwarder</span>
              </button>
              <a
                href="/api/export-zip"
                download="mailpulse-export.zip"
                onClick={() => setIsMoreOpen(false)}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-slate-700 dark:text-slate-200"
              >
                <Archive className="w-4 h-4 text-emerald-500" />
                <span>Export Mailbox ZIP</span>
              </a>
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
              <button
                onClick={() => {
                  onOpenShortcutsModal();
                  setIsMoreOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 text-slate-700 dark:text-slate-200"
              >
                <Keyboard className="w-4 h-4 text-slate-400" />
                <span>Keyboard Shortcuts (?)</span>
              </button>
            </div>
          )}
        </div>

        {/* Keyboard Shortcuts Trigger (Desktop only) */}
        <button
          onClick={onOpenShortcutsModal}
          className="hidden md:flex p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>
      </div>
    </header>
  );
};