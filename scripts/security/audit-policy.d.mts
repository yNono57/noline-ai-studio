export interface AuditPolicyEntry {
  advisoryId: string;
  package: string;
  expiresOn: string;
}

export interface AuditReport {
  vulnerabilities?: Record<string, { via: Array<string | { name: string; url?: string }> }>;
  metadata?: { vulnerabilities?: { total?: number } };
}

export function evaluateAuditReport(
  report: AuditReport,
  policy: { exceptions: AuditPolicyEntry[] },
  now?: Date,
): { accepted: string[]; rejected: string[] };

export function loadAuditPolicy(): { exceptions: AuditPolicyEntry[] };
