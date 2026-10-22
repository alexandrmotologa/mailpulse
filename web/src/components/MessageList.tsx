import React from 'react';
import { 
  Search, 
  X, 
  Star, 
  Trash2, 
  Paperclip, 
  Key, 
  ShieldAlert, 
  CheckCheck 
} from 'lucide-react';
import { MessageSummary } from '../types';

interface MessageListProps {
  messages: MessageSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onToggleStar: (id: string, isStarred: boolean, e: React.MouseEvent) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  currentTag: string;
  onTagChange: (tag: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  selectedId,
  onSelect,
  onDelete,
  onToggleStar,
  searchQuery,
  onSearchChange,
  currentTag,
  onTagChange,
}) => {
  const filterTabs = [
    { id: '', label: 'All' },
    { id: 'otp', label: 'OTP Codes', icon: Key },
    { id: 'flagged', label: 'Spam Flags', icon: ShieldAlert },
    { id: 'has_attachment', label: 'Files', icon: Paperclip },
    { id: 'starred', label: 'Starred', icon: Star },
  ];

  const formatTimeAgo = (dateStr: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-80 md:w-96 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full shrink-0">
      {/* Search Bar */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg border border-transparent focus:border-slate-300 dark:focus:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-colors text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 mt-2.5 overflow-x-auto pb-0.5 no-scrollbar">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTag === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTagChange(tab.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
        {messages.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <CheckCheck className="w-6 h-6 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="font-semibold text-slate-600 dark:text-slate-400">No emails found</p>
            <p className="mt-1 text-slate-400">Send an email via SMTP :1025 or click "Send Sample"</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelected = msg.id === selectedId;
            return (
              <div
                key={msg.id}
                onClick={() => onSelect(msg.id)}
                className={`p-3.5 cursor-pointer transition-colors relative group ${
                  isSelected
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-l-4 border-indigo-600'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                } ${!msg.isRead ? 'bg-slate-50/40 dark:bg-slate-900/60' : ''}`}
              >
                {/* Sender & Timestamp */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 truncate">
                    {!msg.isRead && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                    )}
                    <span className={`text-xs truncate ${!msg.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                      {msg.from.name || msg.from.address}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono shrink-0">
                    {formatTimeAgo(msg.receivedAt)}
                  </span>
                </div>

                {/* Subject */}
                <div className={`text-xs truncate mb-1 ${!msg.isRead ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                  {msg.subject || '(No Subject)'}
                </div>

                {/* Snippet */}
                <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                  {msg.snippet || 'No plain text preview'}
                </div>

                {/* Badges & Actions Footer */}
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* OTP Code Badge */}
                    {msg.otpCode && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80">
                        <Key className="w-2.5 h-2.5" />
                        <span>{msg.otpCode}</span>
                      </span>
                    )}

                    {/* Deliverability Badge */}
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono font-bold border ${
                        msg.spamScore >= 80
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                          : msg.spamScore >= 50
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                      }`}
                      title={`Deliverability Score: ${msg.spamScore}/100`}
                    >
                      <span>{msg.spamScore}</span>
                    </span>

                    {/* Attachments Icon */}
                    {msg.attachmentCount > 0 && (
                      <span className="flex items-center gap-0.5 text-slate-400 font-mono">
                        <Paperclip className="w-3 h-3" />
                        <span>{msg.attachmentCount}</span>
                      </span>
                    )}
                  </div>

                  {/* Actions on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => onToggleStar(msg.id, !msg.isStarred, e)}
                      className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${
                        msg.isStarred ? 'text-amber-500 fill-amber-500 opacity-100' : 'text-slate-400'
                      }`}
                      title={msg.isStarred ? 'Unstar' : 'Star'}
                    >
                      <Star className={`w-3.5 h-3.5 ${msg.isStarred ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => onDelete(msg.id, e)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Delete email"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
