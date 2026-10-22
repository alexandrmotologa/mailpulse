import React, { useState } from 'react';
import { Copy, Check, Search, Download } from 'lucide-react';

interface RawMimeDrawerProps {
  messageId: string;
  headers: Record<string, string[]>;
}

export const RawMimeDrawer: React.FC<RawMimeDrawerProps> = ({ messageId, headers }) => {
  const [filter, setFilter] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const headerKeys = Object.keys(headers || {}).filter((k) =>
    k.toLowerCase().includes(filter.toLowerCase()) ||
    headers[k].some((v) => v.toLowerCase().includes(filter.toLowerCase()))
  );

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(`${key}: ${value}`);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
      {/* Search Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter headers..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
          />
        </div>

        <a
          href={`/api/messages/${messageId}/raw`}
          download={`${messageId}.eml`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download .EML</span>
        </a>
      </div>

      {/* Headers Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden font-mono text-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-left border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 px-3 font-semibold w-1/4">Header</th>
                <th className="py-2 px-3 font-semibold">Value</th>
                <th className="py-2 px-3 font-semibold w-10 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {headerKeys.map((key) => {
                const val = headers[key].join(', ');
                const isCopied = copiedKey === key;
                return (
                  <tr key={key} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 group">
                    <td className="py-2 px-3 font-semibold text-indigo-600 dark:text-indigo-400 align-top">
                      {key}
                    </td>
                    <td className="py-2 px-3 text-slate-800 dark:text-slate-200 break-all select-text">
                      {val}
                    </td>
                    <td className="py-2 px-3 text-center align-top">
                      <button
                        onClick={() => handleCopy(key, val)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 transition-opacity"
                        title="Copy header line"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
