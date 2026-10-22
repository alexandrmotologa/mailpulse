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
    <div className="bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-indigo-500/10 border-b border-indigo-200/80 dark:border-indigo-900/60 px-4 py-2.5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
          <Key className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              One-Time Passcode Detected
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-medium">
              {otp.type}
            </span>
          </div>
          {otp.context && (
            <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 max-w-md">
              "{otp.context}"
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {otp.expiration && (
          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hidden sm:flex">
            <Clock className="w-3.5 h-3.5" />
            <span>{otp.expiration}</span>
          </div>
        )}

        <div className="flex items-center bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg p-1 shadow-xs">
          <span className="font-mono font-bold text-lg tracking-widest text-slate-900 dark:text-white px-2.5">
            {otp.code}
          </span>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
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
