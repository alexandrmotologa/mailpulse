import { useEffect, useRef, useState, useCallback } from 'react';
import { MessageSummary } from '../types';

interface UseMailStreamOptions {
  onNewMessage?: (msg: MessageSummary) => void;
  onDeleteMessage?: (id: string) => void;
  onClearAll?: () => void;
  onUpdateMessage?: (data: { id: string; isRead?: boolean; isStarred?: boolean }) => void;
}

export function useMailStream(options: UseMailStreamOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: number | undefined;

    const connect = () => {
      es = new EventSource('/api/events');

      es.onopen = () => {
        setIsConnected(true);
      };

      es.onerror = () => {
        setIsConnected(false);
        es?.close();
        // Retry connection after 3 seconds
        retryTimeout = window.setTimeout(connect, 3000);
      };

      es.addEventListener('new_message', (e) => {
        try {
          const data = JSON.parse(e.data) as MessageSummary;
          optionsRef.current.onNewMessage?.(data);
          // Play subtle audio chime if tab in background
          playChime();
        } catch (err) {
          console.error('Error parsing new_message event:', err);
        }
      });

      es.addEventListener('delete_message', (e) => {
        try {
          const data = JSON.parse(e.data) as { id: string };
          optionsRef.current.onDeleteMessage?.(data.id);
        } catch (err) {
          console.error('Error parsing delete_message event:', err);
        }
      });

      es.addEventListener('clear_all', () => {
        optionsRef.current.onClearAll?.();
      });

      es.addEventListener('update_message', (e) => {
        try {
          const data = JSON.parse(e.data);
          optionsRef.current.onUpdateMessage?.(data);
        } catch (err) {
          console.error('Error parsing update_message event:', err);
        }
      });
    };

    connect();

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      es?.close();
    };
  }, []);

  const playChime = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.15); // E6
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {
      // AudioContext unavailable or blocked by autoplay policy
    }
  }, []);

  return { isConnected, playChime };
}
