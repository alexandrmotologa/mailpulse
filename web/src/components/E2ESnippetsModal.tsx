import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Sparkles } from 'lucide-react';

interface E2ESnippetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetEmail?: string;
  smtpPort?: number;
  webPort?: number;
}

type SnippetTab = 'playwright' | 'cypress' | 'pytest' | 'curl';

export const E2ESnippetsModal: React.FC<E2ESnippetsModalProps> = ({
  isOpen,
  onClose,
  targetEmail = 'user@example.com',
  smtpPort = 1025,
  webPort = 8025,
}) => {
  const [activeTab, setActiveTab] = useState<SnippetTab>('playwright');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const emailParam = encodeURIComponent(targetEmail);

  const snippets: Record<SnippetTab, { title: string; lang: string; code: string; notes: string }> = {
    playwright: {
      title: 'Playwright (TypeScript)',
      lang: 'typescript',
      code: `import { test, expect } from '@playwright/test';

test('sign in with email verification OTP', async ({ page, request }) => {
  // 1. Trigger the verification email in your web application
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', '${targetEmail}');
  await page.click('button[type="submit"]');

  // 2. Poll MailPulse long-polling endpoint (waits until message arrives)
  const response = await request.get('http://127.0.0.1:${webPort}/api/messages/wait?to=${emailParam}&timeout=15');
  expect(response.status()).toBe(200);

  const message = await response.json();
  const otpCode = message.otp?.code;
  expect(otpCode).toBeTruthy();

  // 3. Enter the extracted passcode and assert authenticated session
  await page.fill('input[name="otp"]', otpCode);
  await page.click('button:has-text("Verify")');
  await expect(page).toHaveURL('/dashboard');
});`,
      notes: 'Blocks up to 15 seconds until an email for this recipient is captured, then returns immediately.',
    },
    cypress: {
      title: 'Cypress (JavaScript)',
      lang: 'javascript',
      code: `describe('Authentication Flow', () => {
  it('receives OTP and logs in successfully', () => {
    // 1. Submit login form
    cy.visit('/login');
    cy.get('input[type="email"]').type('${targetEmail}');
    cy.get('button[type="submit"]').click();

    // 2. Query MailPulse wait endpoint with timeout
    cy.request({
      method: 'GET',
      url: 'http://127.0.0.1:${webPort}/api/messages/wait?to=${emailParam}&timeout=15',
      timeout: 20000,
    }).then((response) => {
      expect(response.status).to.eq(200);
      const code = response.body.otp.code;

      // 3. Fill verification input
      cy.get('input[name="otp"]').type(code);
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/dashboard');
    });
  });
});`,
      notes: 'Seamlessly works in local development and Dockerized CI containers without external email services.',
    },
    pytest: {
      title: 'Pytest / Python',
      lang: 'python',
      code: `import requests
import pytest

MAILPULSE_URL = "http://127.0.0.1:${webPort}"

def test_registration_magic_link():
    # 1. Trigger registration email from backend or API client
    # client.post("/api/register", json={"email": "${targetEmail}"})

    # 2. Block until MailPulse intercepts the confirmation email
    params = {"to": "${targetEmail}", "timeout": 10}
    res = requests.get(f"{MAILPULSE_URL}/api/messages/wait", params=params)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"

    msg = res.json()
    magic_links = msg.get("magicLinks", [])
    assert len(magic_links) > 0, "No magic link found in captured email"

    target_url = magic_links[0]["url"]
    print(f"Captured verification link: {target_url}")

    # 3. Simulate user clicking the link
    confirm_res = requests.get(target_url)
    assert confirm_res.status_code in (200, 302)`,
      notes: 'Uses standard requests with automatic timeout handling. Safe for parallel test workers.',
    },
    curl: {
      title: 'cURL / Shell CLI',
      lang: 'bash',
      code: `# 1. Wait for email and extract 6-digit OTP code directly using jq
OTP=$(curl -s "http://127.0.0.1:${webPort}/api/messages/wait?to=${emailParam}&timeout=10" | jq -r '.otp.code')
echo "Extracted Passcode: $OTP"

# 2. Extract first magic link URL
LINK=$(curl -s "http://127.0.0.1:${webPort}/api/messages/wait?to=${emailParam}&timeout=10" | jq -r '.magicLinks[0].url')
echo "Extracted Link: $LINK"

# 3. Send test email to local SMTP daemon
swaks --to ${targetEmail} --server 127.0.0.1:${smtpPort} --header "Subject: Verification" --body "Your code is 482910"`,
      notes: 'Perfect for CI/CD shell scripts, smoke tests, and Docker health-checks.',
    },
  };

  const currentSnippet = snippets[activeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSnippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>E2E Test Automation Recipes</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                  Zero Polling Delay
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Use the blocking <code className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">GET /api/messages/wait</code> endpoint for deterministic automated testing.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          {(Object.keys(snippets) as SnippetTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab === 'pytest' ? 'Pytest / Python' : tab === 'curl' ? 'cURL / CLI' : tab}
            </button>
          ))}
        </div>

        {/* Snippet display body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>{currentSnippet.title}</span>
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>{currentSnippet.lang}</span>
              <span>Target: {targetEmail}</span>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed select-all">
              {currentSnippet.code}
            </pre>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-bold text-slate-900 dark:text-white">Note: </span>
            {currentSnippet.notes}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500">
          <span>MailPulse API: http://127.0.0.1:{webPort}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
