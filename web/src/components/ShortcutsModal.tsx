import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const categories = [
    {
      name: 'Navigation & Inbox',
      items: [
        { keys: ['j', '↓'], desc: 'Select next email down' },
        { keys: ['k', '↑'], desc: 'Select previous email up' },
        { keys: ['/'], desc: 'Focus inbox search field' },
      ],
    },
    {
      name: 'Quick Actions',
      items: [
        { keys: ['c'], desc: 'Copy OTP verification passcode to clipboard' },
        { keys: ['s'], desc: 'Toggle star / bookmark' },
        { keys: ['x'], desc: 'Toggle read / unread status' },
        { keys: ['Delete'], desc: 'Delete selected email' },
      ],
    },
    {
      name: 'Inspect Views',
      items: [
        { keys: ['1'], desc: 'Switch to HTML Sandbox tab' },
        { keys: ['2'], desc: 'Switch to Plain Text tab' },
        { keys: ['3'], desc: 'Switch to Raw HTML source tab' },
        { keys: ['4'], desc: 'Switch to Spam Audit report tab' },
        { keys: ['5'], desc: 'Switch to MIME Headers tab' },
        { keys: ['d'], desc: 'Toggle Desktop & Mobile Dual-View' },
      ],
    },
    {
      name: 'General',
      items: [
        { keys: ['?'], desc: 'Show this keyboard shortcuts guide' },
        { keys: ['Esc'], desc: 'Close open dialogs or unfocus inputs' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Superhuman and Gmail inspired hotkeys for rapid email testing.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {categories.map((category) => (
            <div key={category.name} className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {category.name}
              </div>
              <div className="space-y-1.5">
                {category.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-slate-50/70 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60"
                  >
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {item.desc}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, kidx) => (
                        <kbd
                          key={kidx}
                          className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Command className="w-3.5 h-3.5 text-indigo-500" />
            <span>Shortcuts are active when focus is outside text fields</span>
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
