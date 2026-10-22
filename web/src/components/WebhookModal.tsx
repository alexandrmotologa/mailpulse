import React, { useState, useEffect } from 'react';
import { X, Webhook as WebhookIcon, Check, RefreshCw, Send, Clock, Globe } from 'lucide-react';
import { WebhookLog } from '../types';

interface WebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshLogs: () => Promise<WebhookLog[]>;
  onSaveConfig: (url: string) => Promise<void>;
  currentUrl: string;
}

export const WebhookModal: React.FC<WebhookModalProps> = ({
  isOpen,
  onClose,
  onRefreshLogs,
  onSaveConfig,
  currentUrl,
}) => {
  const [url, setUrl] = useState(currentUrl);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setUrl(currentUrl);
  }, [currentUrl]);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  const loadLogs = async () => {
    setIsRefreshing(true);
    try {
      const data = await onRefreshLogs();
      setLogs(data);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveConfig(url);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
              <WebhookIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Local Webhook Forwarding
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Forward incoming emails as JSON POST requests to your development API
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Form */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <form onSubmit={handleSave} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Webhook Endpoint URL
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  placeholder="http://localhost:3000/api/webhooks/incoming-email"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                />
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save URL</span>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Leave blank to disable automatic forwarding. You can still forward individual emails on demand.
            </p>
          </form>
        </div>

        {/* Delivery Logs */}
        <div className="flex-1 overflow-hidden flex flex-col p-6">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Recent Delivery Attempts ({logs.length})
            </h4>
            <button
              onClick={loadLogs}
              disabled={isRefreshing}
              className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <Send className="w-6 h-6 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                No webhook deliveries attempted yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {logs.map((log) => (
                  <div key={log.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {log.success ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[10px]">
                            {log.statusCode || 200} OK
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-mono font-bold text-[10px]">
                            {log.statusCode || 'ERR'}
                          </span>
                        )}
                        <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-xs">
                          {log.url}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{log.durationMs}ms</span>
                        <span>{new Date(log.attemptedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    {log.error && (
                      <div className="text-[11px] text-rose-500 font-mono mt-1">
                        Error: {log.error}
                      </div>
                    )}
                    {log.responseBody && (
                      <div className="text-[11px] text-slate-500 font-mono truncate mt-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded">
                        Response: {log.responseBody}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
