export interface Address {
  name: string;
  address: string;
}

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
}

export interface OTPInfo {
  code: string;
  type: string;
  context: string;
  expiration?: string;
}

export interface MagicLink {
  url: string;
  text: string;
  host: string;
  parameters?: Record<string, string>;
  category: 'login' | 'verification' | 'password_reset' | 'unsubscribe' | 'general';
}

export interface SpamIssue {
  code: string;
  severity: 'warning' | 'critical' | 'info';
  points: number;
  description: string;
  suggestion: string;
}

export interface SpamReport {
  score: number;
  verdict: 'pass' | 'warning' | 'fail';
  textToImageRatio: number;
  htmlSizeBytes: number;
  hasClippingRisk: boolean;
  issues: SpamIssue[];
}

export interface MessageSummary {
  id: string;
  receivedAt: string;
  from: Address;
  to: Address[];
  subject: string;
  snippet: string;
  hasHtml: boolean;
  hasText: boolean;
  attachmentCount: number;
  otpCode?: string;
  spamScore: number;
  spamVerdict: 'pass' | 'warning' | 'fail';
  sizeBytes: number;
  isRead: boolean;
  isStarred: boolean;
}

export interface MessageDetail {
  id: string;
  receivedAt: string;
  from: Address;
  to: Address[];
  cc: Address[];
  bcc: Address[];
  replyTo: Address[];
  subject: string;
  snippet: string;
  textBody: string;
  htmlBody: string;
  headers: Record<string, string[]>;
  attachments: Attachment[];
  otp?: OTPInfo;
  magicLinks: MagicLink[];
  spamReport: SpamReport;
  sizeBytes: number;
  isRead: boolean;
  isStarred: boolean;
}

export interface ServerStats {
  totalMessages: number;
  unreadCount: number;
  otpCount: number;
  flaggedSpamCount: number;
  smtpPort: number;
  webPort: number;
  storageType: string;
  uptimeSeconds: number;
  startedAt: string;
}

export interface WebhookLog {
  id: string;
  messageId: string;
  url: string;
  attemptedAt: string;
  statusCode: number;
  durationMs: number;
  success: boolean;
  responseBody: string;
  error?: string;
}
