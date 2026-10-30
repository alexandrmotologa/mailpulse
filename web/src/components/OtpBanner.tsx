import React, { useState } from 'react';
import { Key, Copy, Check, Clock } from 'lucide-react';
import { OTPInfo } from '../types';

interface OtpBannerProps {
  otp: OTPInfo;
}

export const OtpBanner: React.FC<OtpBannerProps> = ({ otp }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(otp.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy OTP code:', err);
    }
  };

  return (
    <div className="bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-indigo-500/10 border-b border-indigo-200/80 dark:border-indigo-900/60 px-3 sm:px-4 py-2.5 flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-indigo-600/30">
          <Key className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              Passcode Detected
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-semibold">
              {otp.type}
            </span>
            {otp.expiration && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                <Clock className="w-3 h-3" />
                <span>{otp.expiration}</span>
              </span>
            )}
          </div>
          {otp.context && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-lg">
              "{otp.context}"
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
        <div className="flex items-center bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl p-1 shadow-xs">
          <span className="font-mono font-bold text-base sm:text-lg tracking-widest text-slate-900 dark:text-white px-2.5">
            {otp.code}
          </span>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-xs shadow-indigo-600/20'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
