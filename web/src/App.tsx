import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { MessageDetail, TabType } from './components/MessageDetail';
import { WebhookModal } from './components/WebhookModal';
import { E2ESnippetsModal } from './components/E2ESnippetsModal';
import { ChaosModal } from './components/ChaosModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { useMailStream } from './hooks/useMailStream';
import { MessageSummary, MessageDetail as IMessageDetail, ServerStats, WebhookLog, ChaosConfig } from './types';
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

  // Active detail tab
  const [activeDetailTab, setActiveDetailTab] = useState<TabType>('preview');

  // Modals state
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [isE2EModalOpen, setIsE2EModalOpen] = useState(false);
  const [e2eTargetEmail, setE2eTargetEmail] = useState('user@example.com');
  const [isChaosModalOpen, setIsChaosModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  const [webhookUrl, setWebhookUrl] = useState('');
  const [chaosConfig, setChaosConfig] = useState<ChaosConfig | null>(null);

  // Apply dark mode class to html element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Load initial stats, webhook config, and chaos config
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

  const fetchChaosConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/chaos/config');
      if (res.ok) {
        const data = await res.json();
        setChaosConfig(data);
      }
    } catch (err) {
      console.error('Failed to fetch chaos config:', err);
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
    fetchChaosConfig();
  }, [fetchStats, fetchWebhookConfig, fetchChaosConfig]);

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
        setSelectedMessage((prev) => (prev ? { ...prev, isStarred } : null));
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
        setSelectedMessage((prev) => (prev ? { ...prev, isRead } : null));
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

  // Keyboard navigation & shortcuts (Superhuman / Gmail style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        setIsWebhookModalOpen(false);
        setIsE2EModalOpen(false);
        setIsChaosModalOpen(false);
        setIsShortcutsModalOpen(false);
        return;
      }

      if (e.key === '?') {
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // Next / Previous email
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (messages.length === 0) return;
        const currentIndex = messages.findIndex((m) => m.id === selectedId);
        if (currentIndex === -1 || currentIndex >= messages.length - 1) {
          setSelectedId(messages[0].id);
        } else {
          setSelectedId(messages[currentIndex + 1].id);
        }
        return;
      }

      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (messages.length === 0) return;
        const currentIndex = messages.findIndex((m) => m.id === selectedId);
        if (currentIndex <= 0) {
          setSelectedId(messages[messages.length - 1].id);
        } else {
          setSelectedId(messages[currentIndex - 1].id);
        }
        return;
      }

      // Actions on selected message
      if (selectedMessage) {
        if (e.key === 'c' && selectedMessage.otp?.code) {
          navigator.clipboard.writeText(selectedMessage.otp.code);
          return;
        }

        if (e.key === 's') {
          handleToggleStar(selectedMessage.id, !selectedMessage.isStarred);
          return;
        }

        if (e.key === 'x' || e.key === 'r') {
          handleToggleRead(selectedMessage.id, !selectedMessage.isRead);
          return;
        }

        if (e.key === 'Delete' || e.key === '#') {
          handleDelete(selectedMessage.id);
          return;
        }

        // View Tabs switching
        if (e.key === '1') setActiveDetailTab('preview');
        if (e.key === '2') setActiveDetailTab('text');
        if (e.key === '3') setActiveDetailTab('html');
        if (e.key === '4') setActiveDetailTab('spam');
        if (e.key === '5') setActiveDetailTab('headers');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [messages, selectedId, selectedMessage]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Top Application Header */}
      <Header
        stats={stats}
        isConnected={isConnected}
        isDarkMode={isDarkMode}
        isChaosEnabled={chaosConfig?.enabled}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        onClearAll={handleClearAll}
        onSendSample={handleSendSample}
        onOpenWebhookModal={() => setIsWebhookModalOpen(true)}
        onOpenChaosModal={() => setIsChaosModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
      />

      {/* Main Studio Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Inbox Sidebar */}
        <div className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 shrink-0 h-full overflow-hidden`}>
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
        </div>

        {/* Right Detail Pane */}
        {selectedMessage ? (
          <div className={`${!selectedId ? 'hidden md:flex' : 'flex'} flex-1 h-full overflow-hidden`}>
            <MessageDetail
              message={selectedMessage}
              onDelete={handleDelete}
              onToggleStar={handleToggleStar}
              onToggleRead={handleToggleRead}
              onForwardToWebhook={handleForwardToWebhook}
              onOpenE2EModal={(email) => {
                setE2eTargetEmail(email);
                setIsE2EModalOpen(true);
              }}
              onBack={() => setSelectedId(null)}
              activeTab={activeDetailTab}
              onTabChange={setActiveDetailTab}
            />
          </div>
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
                  Local SMTP server listening on <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">127.0.0.1:{stats?.smtpPort || 1025}</span>. Any email sent from your development environment will appear here instantly.
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
                  onClick={() => setIsE2EModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  E2E Recipes
                </button>
                <button
                  onClick={() => setIsWebhookModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  Webhooks
                </button>
              </div>

              {/* Code Snippet for quick connection */}
              <div className="mt-8 text-left bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400 text-[11px] mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Quick Nodemailer Config</span>
                  </span>
                  <span>Port {stats?.smtpPort || 1025}</span>
                </div>
                <pre className="text-slate-700 dark:text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
{`const transporter = nodemailer.createTransport({
  host: "127.0.0.1",
  port: ${stats?.smtpPort || 1025},
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

      {/* E2E Test Recipes Modal */}
      <E2ESnippetsModal
        isOpen={isE2EModalOpen}
        onClose={() => setIsE2EModalOpen(false)}
        targetEmail={e2eTargetEmail}
        smtpPort={stats?.smtpPort || 1025}
        webPort={stats?.webPort || 8025}
      />

      {/* SMTP Chaos Simulator Modal */}
      <ChaosModal
        isOpen={isChaosModalOpen}
        onClose={() => setIsChaosModalOpen(false)}
        onConfigChange={(newCfg) => setChaosConfig(newCfg)}
      />

      {/* Keyboard Shortcuts Cheatsheet Modal */}
      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </div>
  );
}
