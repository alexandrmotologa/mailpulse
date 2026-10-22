import React, { useState, useEffect } from 'react';
import { X, Flame, AlertTriangle, Clock, RefreshCw, Check } from 'lucide-react';
import { ChaosConfig } from '../types';

interface ChaosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange?: (config: ChaosConfig) => void;
}

export const ChaosModal: React.FC<ChaosModalProps> = ({ isOpen, onClose, onConfigChange }) => {
  const [config, setConfig] = useState<ChaosConfig>({
    enabled: false,
    latencyMs: 0,
    failureRate: 0,
    errorCode: 421,
    errorMessage: '4.3.0 MailPulse Chaos: Temporary service failure',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/chaos/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Failed to load chaos config:', err);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/chaos/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        onConfigChange?.(updated);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save chaos config:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig({
      enabled: false,
      latencyMs: 0,
      failureRate: 0,
      errorCode: 421,
      errorMessage: '4.3.0 MailPulse Chaos: Temporary service failure',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
              config.enabled 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' 
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
            }`}>
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>SMTP Chaos & Latency Simulator</span>
                {config.enabled && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/30">
                    ACTIVE
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inject artificial delays and SMTP error responses to test client retry resilience.
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
        <div className="p-6 space-y-6">
          {/* Main Toggle Switch */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
            <div>
              <div className="font-semibold text-sm text-slate-900 dark:text-white">
                Enable Chaos Simulator
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                When active, incoming SMTP connections will be intercepted with the rules below.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {/* Latency Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Artificial Network Latency</span>
              </span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {config.latencyMs} ms
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="5000"
              step="50"
              value={config.latencyMs}
              onChange={(e) => setConfig({ ...config, latencyMs: parseInt(e.target.value, 10) || 0 })}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0 ms (Instant)</span>
              <span>1000 ms</span>
              <span>2500 ms</span>
              <span>5000 ms (Slow)</span>
            </div>
          </div>

          {/* Failure Rate Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>SMTP Failure Rate</span>
              </span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {config.failureRate}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={config.failureRate}
              onChange={(e) => setConfig({ ...config, failureRate: parseInt(e.target.value, 10) || 0 })}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0% (Always succeed)</span>
              <span>50% (Flaky)</span>
              <span>100% (Always fail)</span>
            </div>
          </div>

          {/* Error Code & Message */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Simulated SMTP Code
              </label>
              <select
                value={config.errorCode}
                onChange={(e) => {
                  const code = parseInt(e.target.value, 10);
                  let defaultMsg = '4.3.0 MailPulse Chaos: Temporary service failure';
                  if (code === 450) defaultMsg = '4.2.0 MailPulse Chaos: Mailbox busy or temporarily unavailable';
                  if (code === 550) defaultMsg = '5.1.1 MailPulse Chaos: Mailbox unavailable or rejected';
                  if (code === 554) defaultMsg = '5.5.0 MailPulse Chaos: Transaction failed';
                  setConfig({ ...config, errorCode: code, errorMessage: defaultMsg });
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
              >
                <option value={421}>421 - Service not available (Temp fail)</option>
                <option value={450}>450 - Mailbox busy (Temp fail)</option>
                <option value={550}>550 - Mailbox unavailable (Permanent fail)</option>
                <option value={554}>554 - Transaction failed (Permanent fail)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                SMTP Response Banner
              </label>
              <input
                type="text"
                value={config.errorMessage}
                onChange={(e) => setConfig({ ...config, errorMessage: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset to Normal</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Applied!</span>
                </>
              ) : isSaving ? (
                <span>Applying...</span>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
