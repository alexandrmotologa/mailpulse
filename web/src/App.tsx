import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { MessageDetail } from './components/MessageDetail';
import { WebhookModal } from './components/WebhookModal';
import { useMailStream } from './hooks/useMailStream';
import { MessageSummary, MessageDetail as IMessageDetail, ServerStats, WebhookLog } from './types';
import { Inbox, Terminal } from 'lucide-react';

export function App() {
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<IMessageDetail | null>(null);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTag, setCurrentTag] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  // Apply dark mode class to html element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Load initial stats and webhook config
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchWebhookConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/webhook/config');
      if (res.ok) {
        const data = await res.json();
        setWebhookUrl(data.url || '');
      }
    } catch (err) {
      console.error('Failed to fetch webhook config:', err);
    }
  }, []);

  // Fetch message list
  const fetchMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('query', searchQuery);
      if (currentTag) params.set('tag', currentTag);

      const res = await fetch(`/api/messages?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        // If current selected message was deleted, select first available
        if (selectedId && !data.messages?.some((m: MessageSummary) => m.id === selectedId)) {
          if (data.messages?.length > 0) {
            setSelectedId(data.messages[0].id);
          } else {
            setSelectedId(null);
            setSelectedMessage(null);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, [searchQuery, currentTag, selectedId]);

  // Fetch single message detail
  const fetchMessageDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/messages/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedMessage(data);
        // Mark as read in list locally
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, isRead: true } : m))
        );
      }
    } catch (err) {
      console.error('Failed to fetch message detail:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchWebhookConfig();
  }, [fetchStats, fetchWebhookConfig]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (selectedId) {
      fetchMessageDetail(selectedId);
    } else {
      setSelectedMessage(null);
    }
  }, [selectedId, fetchMessageDetail]);

  // Real-time SSE listener
  const { isConnected } = useMailStream({
    onNewMessage: (newMsg) => {
      setMessages((prev) => [newMsg, ...prev.filter((m) => m.id !== newMsg.id)]);
      fetchStats();
      if (!selectedId) {
        setSelectedId(newMsg.id);
      }
    },
    onDeleteMessage: (deletedId) => {
      setMessages((prev) => prev.filter((m) => m.id !== deletedId));
      fetchStats();
      if (selectedId === deletedId) {
        setSelectedId(null);
        setSelectedMessage(null);
      }
    },
    onClearAll: () => {
      setMessages([]);
      setSelectedId(null);
      setSelectedMessage(null);
      fetchStats();
    },
    onUpdateMessage: (data) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === data.id) {
            return {
              ...m,
              isRead: data.isRead !== undefined ? data.isRead : m.isRead,
              isStarred: data.isStarred !== undefined ? data.isStarred : m.isStarred,
            };
          }
          return m;
        })
      );
      if (selectedMessage && selectedMessage.id === data.id) {
        setSelectedMessage((prev) =>
          prev
            ? {
                ...prev,
                isRead: data.isRead !== undefined ? data.isRead : prev.isRead,
                isStarred: data.isStarred !== undefined ? data.isStarred : prev.isStarred,
              }
            : null
        );
      }
    },
  });

  // Action handlers
  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
        if (selectedId === id) {
          const remaining = messages.filter((m) => m.id !== id);
          if (remaining.length > 0) {
            setSelectedId(remaining[0].id);
          } else {
            setSelectedId(null);
            setSelectedMessage(null);
          }
        }
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleClearAll = async () => {
    try {
      const res = await fetch('/api/messages', { method: 'DELETE' });
      if (res.ok) {
        setMessages([]);
        setSelectedId(null);
        setSelectedMessage(null);
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to clear messages:', err);
    }
  };

  const handleToggleStar = async (id: string, isStarred: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await fetch(`/api/messages/${id}/star`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isStarred } : m))
      );
      if (selectedMessage && selectedMessage.id === id) {
        setSelectedMessage((prev) => prev ? { ...prev, isStarred } : null);
      }
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const handleToggleRead = async (id: string, isRead: boolean) => {
    try {
      await fetch(`/api/messages/${id}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isRead } : m))
      );
      if (selectedMessage && selectedMessage.id === id) {
        setSelectedMessage((prev) => prev ? { ...prev, isRead } : null);
      }
    } catch (err) {
      console.error('Failed to toggle read:', err);
    }
  };

  const handleSendSample = async (template: string) => {
    try {
      const res = await fetch('/api/send-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setSelectedId(newMsg.id);
        fetchMessages();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to send sample:', err);
    }
  };

  const handleForwardToWebhook = async (id: string) => {
    try {
      const res = await fetch(`/api/messages/${id}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: webhookUrl }),
      });
      const data = await res.json();
      return { success: data.success, error: data.error };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  };

  const handleSaveWebhookConfig = async (url: string) => {
    const res = await fetch('/api/webhook/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      const data = await res.json();
      setWebhookUrl(data.url);
    }
  };

  const handleRefreshWebhookLogs = async (): Promise<WebhookLog[]> => {
    const res = await fetch('/api/webhook/logs');
    if (res.ok) {
      const data = await res.json();
      return data.logs || [];
    }
    return [];
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Top Application Header */}
      <Header
        stats={stats}
        isConnected={isConnected}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        onClearAll={handleClearAll}
        onSendSample={handleSendSample}
        onOpenWebhookModal={() => setIsWebhookModalOpen(true)}
      />

      {/* Main Studio Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Inbox Sidebar */}
        <MessageList
          messages={messages}
          selectedId={selectedId}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onToggleStar={handleToggleStar}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentTag={currentTag}
          onTagChange={setCurrentTag}
        />

        {/* Right Detail Pane */}
        {selectedMessage ? (
          <MessageDetail
            message={selectedMessage}
            onDelete={handleDelete}
            onToggleStar={handleToggleStar}
            onToggleRead={handleToggleRead}
            onForwardToWebhook={handleForwardToWebhook}
          />
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-950 text-center select-text">
            <div className="max-w-md space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
                <Inbox className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  MailPulse Email Studio
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Local SMTP server listening on <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">127.0.0.1:1025</span>. Any email sent from your development environment will appear here instantly.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => handleSendSample('otp')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
                >
                  Generate Sample Email
                </button>
                <button
                  onClick={() => setIsWebhookModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  Configure Webhook
                </button>
              </div>

              {/* Code Snippet for quick connection */}
              <div className="mt-8 text-left bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400 text-[11px] mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Quick Nodemailer Config</span>
                  </span>
                  <span>Port 1025</span>
                </div>
                <pre className="text-slate-700 dark:text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
{`const transporter = nodemailer.createTransport({
  host: "127.0.0.1",
  port: 1025,
  secure: false,
});`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Webhook Configuration Modal */}
      <WebhookModal
        isOpen={isWebhookModalOpen}
        onClose={() => setIsWebhookModalOpen(false)}
        onRefreshLogs={handleRefreshWebhookLogs}
        onSaveConfig={handleSaveWebhookConfig}
        currentUrl={webhookUrl}
      />
    </div>
  );
}
