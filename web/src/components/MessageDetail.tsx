import React, { useState } from 'react';
import { 
  Star, 
  Trash2, 
  Download, 
  Eye, 
  Code, 
  FileText, 
  ShieldCheck, 
  ListTree, 
  Paperclip, 
  Link as LinkIcon, 
  ExternalLink, 
  Copy, 
  Check, 
  Share2, 
  MailCheck,
  Terminal,
  FileCode,
  Activity,
  AlertCircle,
  ChevronLeft
} from 'lucide-react';
import { MessageDetail as IMessageDetail, LinkProbeResult } from '../types';
import { DeviceFrame } from './DeviceFrame';
import { OtpBanner } from './OtpBanner';
import { SpamAuditScore } from './SpamAuditScore';
import { RawMimeDrawer } from './RawMimeDrawer';

interface MessageDetailProps {
  message: IMessageDetail;
  onDelete: (id: string) => void;
  onToggleStar: (id: string, isStarred: boolean) => void;
  onToggleRead: (id: string, isRead: boolean) => void;
  onForwardToWebhook: (id: string) => Promise<{ success: boolean; error?: string }>;
  onOpenE2EModal: (recipientEmail: string) => void;
  onBack?: () => void;
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
}

export type TabType = 'preview' | 'text' | 'html' | 'spam' | 'headers' | 'attachments';

export const MessageDetail: React.FC<MessageDetailProps> = ({
  message,
  onDelete,
  onToggleStar,
  onToggleRead,
  onForwardToWebhook,
  onOpenE2EModal,
  onBack,
  activeTab: externalTab,
  onTabChange,
}) => {
  const [internalTab, setInternalTab] = useState<TabType>('preview');
  const activeTab = externalTab ?? internalTab;
  const setActiveTab = (tab: TabType) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardSuccess, setForwardSuccess] = useState<boolean | null>(null);

  // Link Prober State
  const [isProbing, setIsProbing] = useState(false);
  const [probeResults, setProbeResults] = useState<Record<string, LinkProbeResult>>({});

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(url);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleForward = async () => {
    setIsForwarding(true);
    setForwardSuccess(null);
    try {
      const res = await onForwardToWebhook(message.id);
      setForwardSuccess(res.success);
      setTimeout(() => setForwardSuccess(null), 3000);
    } finally {
      setIsForwarding(false);
    }
  };

  const handleProbeLinks = async () => {
    setIsProbing(true);
    try {
      const res = await fetch(`/api/messages/${message.id}/probe-links`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const resultsMap: Record<string, LinkProbeResult> = {};
        if (data.results && Array.isArray(data.results)) {
          data.results.forEach((r: LinkProbeResult) => {
            resultsMap[r.url] = r;
          });
        }
        setProbeResults(resultsMap);
      }
    } catch (err) {
      console.error('Failed to probe links:', err);
    } finally {
      setIsProbing(false);
    }
  };

  const recipientEmail = message.to[0]?.address || 'user@example.com';

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 shrink-0 bg-white dark:bg-slate-900">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="md:hidden p-1 -ml-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Back to inbox"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {message.subject || '(No Subject)'}
            </h2>
            <button
              onClick={() => onToggleStar(message.id, !message.isStarred)}
              className="text-slate-400 hover:text-amber-500 transition-colors shrink-0"
              title={message.isStarred ? 'Unstar (s)' : 'Star (s)'}
            >
              <Star className={`w-4 h-4 ${message.isStarred ? 'text-amber-500 fill-amber-500' : ''}`} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">From: </span>
              <span>{message.from.name ? `${message.from.name} <${message.from.address}>` : message.from.address}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">To: </span>
              <span>{message.to.map((t) => t.name ? `${t.name} <${t.address}>` : t.address).join(', ')}</span>
            </div>
            <div className="text-slate-400 font-mono">
              {new Date(message.receivedAt).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* E2E Test Recipes Trigger */}
          <button
            onClick={() => onOpenE2EModal(recipientEmail)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition-colors shadow-2xs"
            title="Open automated test recipes (Playwright, Cypress, Pytest)"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">E2E Code</span>
          </button>

          <button
            onClick={() => onToggleRead(message.id, !message.isRead)}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={message.isRead ? "Mark as unread (x)" : "Mark as read (x)"}
          >
            <MailCheck className="w-4 h-4" />
          </button>

          <button
            onClick={handleForward}
            disabled={isForwarding}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
            title="Forward to configured local webhook"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {forwardSuccess === true ? 'Forwarded!' : forwardSuccess === false ? 'Failed' : 'Forward'}
            </span>
          </button>

          {/* Export Self-Contained Standalone HTML */}
          <a
            href={`/api/messages/${message.id}/export-html`}
            download={`mailpulse-${message.id.slice(0, 8)}.html`}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Export standalone portable HTML snapshot"
          >
            <FileCode className="w-4 h-4" />
          </a>

          {/* Download Raw RFC 5322 EML */}
          <a
            href={`/api/messages/${message.id}/raw`}
            download={`${message.id}.eml`}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Download raw EML message file"
          >
            <Download className="w-4 h-4" />
          </a>

          <button
            onClick={() => onDelete(message.id)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            title="Delete email (Delete)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* OTP Banner if present */}
      {message.otp && <OtpBanner otp={message.otp} />}

      {/* Magic Links Strip if present */}
      {message.magicLinks && message.magicLinks.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
              <LinkIcon className="w-3 h-3 text-indigo-500" />
              <span>Extracted Links:</span>
            </div>

            {message.magicLinks.map((link, idx) => {
              const probe = probeResults[link.url];
              return (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs shrink-0 shadow-2xs"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200 max-w-[140px] truncate" title={link.text || link.url}>
                    {link.text || link.host}
                  </span>
                  <span className="text-[10px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 uppercase">
                    {link.category}
                  </span>

                  {/* Probe Result Pill if probed */}
                  {probe && (
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded flex items-center gap-1 ${
                        probe.ok
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          : probe.statusCode >= 300 && probe.statusCode < 400
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                      }`}
                      title={probe.error ? `Error: ${probe.error}` : `Status ${probe.statusCode} in ${probe.durationMs}ms`}
                    >
                      {probe.ok ? (
                        `${probe.statusCode} (${probe.durationMs}ms)`
                      ) : probe.error ? (
                        <>
                          <AlertCircle className="w-2.5 h-2.5" />
                          <span>Err</span>
                        </>
                      ) : (
                        `${probe.statusCode}`
                      )}
                    </span>
                  )}

                  <button
                    onClick={() => handleCopyLink(link.url)}
                    className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    title="Copy link to clipboard"
                  >
                    {copiedLink === link.url ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    title="Open link in new browser tab"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              );
            })}
          </div>

          {/* Active Probe Trigger */}
          <button
            onClick={handleProbeLinks}
            disabled={isProbing}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0 transition-colors shadow-2xs"
            title="Perform active HTTP HEAD/GET health check on all links"
          >
            <Activity className={`w-3 h-3 text-indigo-500 ${isProbing ? 'animate-spin' : ''}`} />
            <span>{isProbing ? 'Probing...' : 'Probe All Links'}</span>
          </button>
        </div>
      )}

      {/* Workspace Tabs Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center gap-1 text-xs shrink-0">
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors ${
            activeTab === 'preview'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Sandbox Preview (1)"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>HTML Sandbox</span>
        </button>

        <button
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors ${
            activeTab === 'text'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Plain Text (2)"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Plain Text</span>
        </button>

        <button
          onClick={() => setActiveTab('html')}
          className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors ${
            activeTab === 'html'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="HTML Source (3)"
        >
          <Code className="w-3.5 h-3.5" />
          <span>HTML Source</span>
        </button>

        <button
          onClick={() => setActiveTab('spam')}
          className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors ${
            activeTab === 'spam'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Deliverability & Spam Audit (4)"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Spam Audit ({message.spamReport.score})</span>
        </button>

        <button
          onClick={() => setActiveTab('headers')}
          className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors ${
            activeTab === 'headers'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="RFC Headers (5)"
        >
          <ListTree className="w-3.5 h-3.5" />
          <span>MIME Headers</span>
        </button>

        {message.attachments && message.attachments.length > 0 && (
          <button
            onClick={() => setActiveTab('attachments')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'attachments'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>Attachments ({message.attachments.length})</span>
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'preview' && (
          <DeviceFrame messageId={message.id} />
        )}

        {activeTab === 'text' && (
          <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-950">
            <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs max-w-4xl mx-auto">
              {message.textBody || '(No plain text body provided)'}
            </pre>
          </div>
        )}

        {activeTab === 'html' && (
          <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-950">
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(message.htmlBody);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-2xs"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy HTML</span>
                </button>
              </div>
              <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto">
                {message.htmlBody || '(No HTML body provided)'}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'spam' && (
          <SpamAuditScore report={message.spamReport} />
        )}

        {activeTab === 'headers' && (
          <RawMimeDrawer messageId={message.id} headers={message.headers} />
        )}

        {activeTab === 'attachments' && (
          <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-950">
            <div className="max-w-3xl mx-auto space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                Message Attachments ({message.attachments.length})
              </h3>
              {message.attachments.map((att) => (
                <div
                  key={att.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                      <Paperclip className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {att.filename}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {att.contentType} • {(att.size / 1024).toFixed(1)} kB
                      </div>
                    </div>
                  </div>

                  <a
                    href={`/api/messages/${message.id}/attachments/${encodeURIComponent(att.filename)}`}
                    download={att.filename}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
