import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Monitor, 
  Tablet, 
  Smartphone, 
  Columns2,
  RotateCw, 
  Sun, 
  Moon, 
  Contrast, 
  ExternalLink, 
  ZoomIn, 
  ZoomOut,
  Link2
} from 'lucide-react';

interface DeviceFrameProps {
  messageId: string;
}

export type DeviceType = 'desktop' | 'dual' | 'ipad' | 'iphone' | 'pixel';
type ColorScheme = 'light' | 'dark' | 'inverted';

export const DeviceFrame: React.FC<DeviceFrameProps> = ({ messageId }) => {
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [isLandscape, setIsLandscape] = useState(false);
  const [colorScheme, setColorScheme] = useState<ColorScheme>('light');
  const [zoom, setZoom] = useState<number>(100);
  const [isSyncScrollEnabled, setIsSyncScrollEnabled] = useState(true);

  const desktopIframeRef = useRef<HTMLIFrameElement>(null);
  const mobileIframeRef = useRef<HTMLIFrameElement>(null);
  const isSyncingRef = useRef(false);

  const deviceDimensions: Record<Exclude<DeviceType, 'dual'>, { width: number; height: number; name: string }> = {
    desktop: { width: 0, height: 0, name: 'Desktop (100%)' },
    ipad: { width: 768, height: 1024, name: 'iPad (768px)' },
    iphone: { width: 393, height: 852, name: 'iPhone 15 (393px)' },
    pixel: { width: 412, height: 915, name: 'Pixel 7 (412px)' },
  };

  const currentDim = device === 'dual' ? deviceDimensions.iphone : deviceDimensions[device];
  const targetWidth = isLandscape ? currentDim.height : currentDim.width;
  const targetHeight = isLandscape ? currentDim.width : currentDim.height;

  // Apply color scheme overrides inside an iframe document
  const applyColorSchemeToDoc = useCallback((doc: Document | null) => {
    if (!doc) return;
    try {
      let styleTag = doc.getElementById('mailpulse-color-scheme') as HTMLStyleElement | null;
      if (!styleTag) {
        styleTag = doc.createElement('style');
        styleTag.id = 'mailpulse-color-scheme';
        doc.head.appendChild(styleTag);
      }

      if (colorScheme === 'dark') {
        styleTag.textContent = `
          :root {
            color-scheme: dark !important;
          }
          body {
            background-color: #121212 !important;
            color: #e2e8f0 !important;
          }
        `;
      } else if (colorScheme === 'inverted') {
        styleTag.textContent = `
          html {
            filter: invert(0.9) hue-rotate(180deg) !important;
            background-color: #000 !important;
          }
          img, video {
            filter: invert(1) hue-rotate(180deg) !important;
          }
        `;
      } else {
        styleTag.textContent = `
          :root {
            color-scheme: light !important;
          }
        `;
      }
    } catch {
      // Ignored for cross-origin or security sandbox restrictions
    }
  }, [colorScheme]);

  const applyIframeColorScheme = useCallback(() => {
    if (desktopIframeRef.current?.contentDocument) {
      applyColorSchemeToDoc(desktopIframeRef.current.contentDocument);
    }
    if (mobileIframeRef.current?.contentDocument) {
      applyColorSchemeToDoc(mobileIframeRef.current.contentDocument);
    }
  }, [applyColorSchemeToDoc]);

  useEffect(() => {
    applyIframeColorScheme();
  }, [applyIframeColorScheme, messageId]);

  // Synchronized scrolling setup between Desktop and Mobile in Dual mode
  useEffect(() => {
    if (device !== 'dual' || !isSyncScrollEnabled) return;

    let cleanupA: (() => void) | undefined;
    let cleanupB: (() => void) | undefined;

    const setupSync = () => {
      const winA = desktopIframeRef.current?.contentWindow;
      const winB = mobileIframeRef.current?.contentWindow;
      const docA = desktopIframeRef.current?.contentDocument;
      const docB = mobileIframeRef.current?.contentDocument;

      if (!winA || !winB || !docA || !docB) return;

      const onScrollA = () => {
        if (isSyncingRef.current) return;
        const maxScrollA = docA.documentElement.scrollHeight - winA.innerHeight;
        const maxScrollB = docB.documentElement.scrollHeight - winB.innerHeight;
        if (maxScrollA <= 0 || maxScrollB <= 0) return;

        const ratio = winA.scrollY / maxScrollA;
        isSyncingRef.current = true;
        winB.scrollTo({ top: ratio * maxScrollB, behavior: 'instant' as ScrollBehavior });
        requestAnimationFrame(() => {
          isSyncingRef.current = false;
        });
      };

      const onScrollB = () => {
        if (isSyncingRef.current) return;
        const maxScrollA = docA.documentElement.scrollHeight - winA.innerHeight;
        const maxScrollB = docB.documentElement.scrollHeight - winB.innerHeight;
        if (maxScrollA <= 0 || maxScrollB <= 0) return;

        const ratio = winB.scrollY / maxScrollB;
        isSyncingRef.current = true;
        winA.scrollTo({ top: ratio * maxScrollA, behavior: 'instant' as ScrollBehavior });
        requestAnimationFrame(() => {
          isSyncingRef.current = false;
        });
      };

      winA.addEventListener('scroll', onScrollA, { passive: true });
      winB.addEventListener('scroll', onScrollB, { passive: true });

      cleanupA = () => winA.removeEventListener('scroll', onScrollA);
      cleanupB = () => winB.removeEventListener('scroll', onScrollB);
    };

    const timer = setTimeout(setupSync, 200);

    return () => {
      clearTimeout(timer);
      cleanupA?.();
      cleanupB?.();
    };
  }, [device, isSyncScrollEnabled, messageId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 dark:bg-slate-950 overflow-hidden">
      {/* Top Viewport Control Bar */}
      <div className="h-11 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 flex items-center justify-between text-xs shrink-0 select-none">
        {/* Device Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
          <button
            onClick={() => setDevice('desktop')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              device === 'desktop'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="Desktop 100%"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Desktop</span>
          </button>

          <button
            onClick={() => setDevice('dual')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              device === 'dual'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="Dual View: Side-by-side Desktop and iPhone with sync scrolling"
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Dual View</span>
          </button>

          <button
            onClick={() => setDevice('ipad')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              device === 'ipad'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="iPad Tablet (768px)"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Tablet</span>
          </button>

          <button
            onClick={() => setDevice('iphone')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              device === 'iphone'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="iPhone 15 (393px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Mobile</span>
          </button>
        </div>

        {/* Orientation & Color Simulation */}
        <div className="flex items-center gap-2">
          {device === 'dual' && (
            <button
              onClick={() => setIsSyncScrollEnabled(!isSyncScrollEnabled)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs transition-colors ${
                isSyncScrollEnabled
                  ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400'
              }`}
              title="Toggle Synchronized Proportional Scrolling"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sync Scroll</span>
            </button>
          )}

          {device !== 'desktop' && device !== 'dual' && (
            <button
              onClick={() => setIsLandscape(!isLandscape)}
              className={`p-1.5 rounded-lg border transition-colors ${
                isLandscape
                  ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800 text-indigo-600'
                  : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Toggle Portrait / Landscape"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Color Scheme Simulation */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => setColorScheme('light')}
              className={`p-1 rounded-md ${
                colorScheme === 'light'
                  ? 'bg-white dark:bg-slate-700 text-amber-500 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Light Mode"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setColorScheme('dark')}
              className={`p-1 rounded-md ${
                colorScheme === 'dark'
                  ? 'bg-white dark:bg-slate-700 text-indigo-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Dark Mode (prefers-color-scheme: dark)"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setColorScheme('inverted')}
              className={`p-1 rounded-md ${
                colorScheme === 'inverted'
                  ? 'bg-white dark:bg-slate-700 text-purple-400 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Client Inversion Simulator (Gmail/Outlook Dark)"
            >
              <Contrast className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom controls */}
          {device !== 'desktop' && device !== 'dual' && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-1 rounded-lg text-[11px] font-mono font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60">
              <button 
                onClick={() => setZoom(Math.max(50, zoom - 25))} 
                className="hover:text-slate-900 dark:hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span>{zoom}%</span>
              <button 
                onClick={() => setZoom(Math.min(100, zoom + 25))} 
                className="hover:text-slate-900 dark:hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Open in new tab */}
          <a
            href={`/api/messages/${messageId}/html`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Open HTML in new browser tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
        {device === 'desktop' ? (
          <div className="w-full h-full bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <iframe
              ref={desktopIframeRef}
              src={`/api/messages/${messageId}/html`}
              title="Email Desktop Preview"
              className="w-full h-full border-0"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
              onLoad={applyIframeColorScheme}
            />
          </div>
        ) : device === 'dual' ? (
          /* Dual View Mode: Side-by-side Desktop and iPhone */
          <div className="w-full h-full flex gap-4 overflow-hidden">
            {/* Left: Desktop Viewport */}
            <div className="flex-1 h-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
              <div className="h-7 bg-slate-100 dark:bg-slate-800/80 px-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Monitor className="w-3 h-3 text-indigo-500" />
                  <span>Desktop 100%</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Fluid Width</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <iframe
                  ref={desktopIframeRef}
                  src={`/api/messages/${messageId}/html`}
                  title="Dual Desktop View"
                  className="w-full h-full border-0"
                  sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                  onLoad={applyIframeColorScheme}
                />
              </div>
            </div>

            {/* Right: Mobile Viewport (iPhone 15) */}
            <div className="w-[393px] h-full shrink-0 flex flex-col items-center">
              <div className="w-full h-7 bg-slate-100 dark:bg-slate-800/80 px-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 rounded-t-xl text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-3 h-3 text-indigo-500" />
                  <span>iPhone 15</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">393 × 852</span>
              </div>
              <div className="w-full flex-1 bg-white dark:bg-slate-900 border-x border-b border-slate-200 dark:border-slate-800 rounded-b-xl overflow-hidden shadow-sm">
                <iframe
                  ref={mobileIframeRef}
                  src={`/api/messages/${messageId}/html`}
                  title="Dual Mobile View"
                  className="w-full h-full border-0"
                  sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                  onLoad={applyIframeColorScheme}
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              width: targetWidth,
              height: targetHeight,
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
            }}
            className={`bg-slate-900 rounded-[38px] p-3 shadow-2xl border-4 border-slate-800 shrink-0 transition-all duration-300 relative flex flex-col`}
          >
            {/* Notch / Speaker for iPhone */}
            {device === 'iphone' && !isLandscape && (
              <div className="w-24 h-4 bg-black rounded-full mx-auto mb-2 shrink-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-slate-950 border border-slate-800 mr-2" />
                <div className="w-2 h-2 rounded-full bg-slate-900" />
              </div>
            )}

            {/* Inner iframe screen */}
            <div className="w-full h-full bg-white rounded-[26px] overflow-hidden relative shadow-inner">
              <iframe
                ref={desktopIframeRef}
                src={`/api/messages/${messageId}/html`}
                title="Email Mobile Preview"
                className="w-full h-full border-0"
                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                onLoad={applyIframeColorScheme}
              />
            </div>

            {/* Home indicator bar for mobile devices */}
            {!isLandscape && (
              <div className="w-28 h-1 bg-slate-600 rounded-full mx-auto mt-2 shrink-0" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
