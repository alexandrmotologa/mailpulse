import React from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Image as ImageIcon, 
  HardDrive,
  Lightbulb
} from 'lucide-react';
import { SpamReport } from '../types';

interface SpamAuditScoreProps {
  report: SpamReport;
}

export const SpamAuditScore: React.FC<SpamAuditScoreProps> = ({ report }) => {
  const issues = report.issues || [];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 stroke-emerald-500';
    if (score >= 50) return 'text-amber-500 stroke-amber-500';
    return 'text-rose-500 stroke-rose-500';
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'pass':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-4 h-4" /> Deliverability Pass
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-4 h-4" /> Deliverability Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <ShieldAlert className="w-4 h-4" /> High Spam Risk
          </span>
        );
    }
  };

  // Convert htmlSizeBytes to kB
  const sizeKb = (report.htmlSizeBytes / 1024).toFixed(1);

  return (
    <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-900/40">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Score Header Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {/* Circular Gauge */}
            <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100 dark:text-slate-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={getScoreColor(report.score)}
                  strokeDasharray={`${report.score}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
                  {report.score}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400">/ 100</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Deliverability Audit
                </h3>
                {getVerdictBadge(report.verdict)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                Heuristic analysis evaluating anti-spam compliance, header RFC requirements, text ratios, and Gmail truncation thresholds.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Text / Image Ratio</span>
              </div>
              <div className="text-base font-mono font-bold text-slate-800 dark:text-slate-200">
                {report.textToImageRatio.toFixed(0)}%
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                <HardDrive className="w-3.5 h-3.5" />
                <span>HTML Size</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-mono font-bold text-slate-800 dark:text-slate-200">
                  {sizeKb} kB
                </span>
                <span className="text-[10px] text-slate-400 font-mono">/ 102 kB limit</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gmail Clipping Alert if triggered */}
        {report.hasClippingRisk && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-bold text-amber-900 dark:text-amber-200">
                Gmail 102 kB Message Truncation Warning
              </div>
              <div className="text-amber-700 dark:text-amber-300 mt-0.5">
                This email exceeds 102,400 bytes ({sizeKb} kB). Gmail clients will truncate the email body and show a '[Message clipped] View entire message' link, which breaks conversion tracking and hidden styling.
              </div>
            </div>
          </div>
        )}

        {/* Detailed Issues List */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Audit Findings ({issues.length})
            </h4>
            {issues.length === 0 && (
              <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> All heuristics passed
              </span>
            )}
          </div>

          {issues.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">No deliverability issues detected</p>
              <p className="mt-1 text-slate-500">This email adheres to standard RFC headers, balanced text ratios, and clean formatting.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {issues.map((issue, idx) => (
                <div key={idx} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {issue.severity === 'critical' ? (
                        <div className="w-6 h-6 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {issue.description}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {issue.code}
                          </span>
                        </div>

                        {issue.suggestion && (
                          <div className="mt-1.5 flex items-start gap-1.5 text-xs text-indigo-700 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                            <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{issue.suggestion}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 shrink-0">
                      -{issue.points} pts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
