import type { AIFREvent, PromptEvent, CommandEvent, ToolEvent, TerminalOutputEvent } from '@aifr/event-schema';

export interface RedactionRule {
  name: string;
  pattern: RegExp;
  replacement: string;
}

export interface RedactionResult {
  totalScanned: number;
  totalRedacted: number;
  matchesByRule: Record<string, number>;
}

const DEFAULT_RULES: RedactionRule[] = [
  // AWS Access Key
  { name: 'aws_access_key', pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[AWS_ACCESS_KEY]' },
  // AWS Secret Key
  { name: 'aws_secret_key', pattern: /(?<=aws_secret_access_key\s*=?\s*)[A-Za-z0-9/+=]{40}/g, replacement: '[AWS_SECRET_KEY]' },
  // GitHub Token
  { name: 'github_token', pattern: /gh[ps]_[A-Za-z0-9_]{36,255}/g, replacement: '[GITHUB_TOKEN]' },
  // JWT tokens (must come before Bearer so JWT format takes priority)
  { name: 'jwt_token', pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, replacement: '[JWT_TOKEN]' },
  // Generic API Key patterns
  { name: 'api_key_bearer', pattern: /(?<=Bearer\s+)[A-Za-z0-9\-._~+/]+=*/g, replacement: '[API_KEY]' },
  { name: 'api_key_header', pattern: /(?<=(?:api[-_]?key|apikey|x-api-key)\s*[:=]\s*["']?)[A-Za-z0-9\-._~+/]{20,}/gi, replacement: '[API_KEY]' },
  // Private keys (PEM header)
  { name: 'private_key', pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA )?PRIVATE KEY-----/g, replacement: '[PRIVATE_KEY]' },
  // Password in connection strings
  { name: 'password_in_url', pattern: /(?<=:\/\/[^:]+:)[^@]+(?=@)/g, replacement: '[PASSWORD]' },
  // Password assignment
  { name: 'password_assignment', pattern: /(?<=(?:password|passwd|pwd)\s*[:=]\s*["']?)[^\s"']+/gi, replacement: '[PASSWORD]' },
  // Email addresses
  { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },
  // Slack tokens
  { name: 'slack_token', pattern: /xox[baprs]-[A-Za-z0-9\-]{10,}/g, replacement: '[SLACK_TOKEN]' },
  // Google API key
  { name: 'google_api_key', pattern: /AIza[0-9A-Za-z\-_]{35}/g, replacement: '[GOOGLE_API_KEY]' },
];

function redactString(input: string, rules: RedactionRule[]): { result: string; matchCounts: Record<string, number> } {
  let result = input;
  const matchCounts: Record<string, number> = {};

  for (const rule of rules) {
    // Reset lastIndex for global regex
    rule.pattern.lastIndex = 0;
    const matches = result.match(rule.pattern);
    if (matches && matches.length > 0) {
      matchCounts[rule.name] = matches.length;
      rule.pattern.lastIndex = 0;
      result = result.replace(rule.pattern, rule.replacement);
    }
  }

  return { result, matchCounts };
}

export function redactEvent(event: AIFREvent, rules: RedactionRule[] = DEFAULT_RULES): { event: AIFREvent; redactedCount: number; matchesByRule: Record<string, number> } {
  const cloned = JSON.parse(JSON.stringify(event)) as AIFREvent;
  let totalRedacted = 0;
  const allMatches: Record<string, number> = {};

  const stringFields = extractStringFields(cloned);
  for (const field of stringFields) {
    const { result, matchCounts } = redactString(field.value, rules);
    if (result !== field.value) {
      field.setter(result);
      for (const [rule, count] of Object.entries(matchCounts)) {
        allMatches[rule] = (allMatches[rule] ?? 0) + count;
        totalRedacted += count;
      }
    }
  }

  return { event: cloned, redactedCount: totalRedacted, matchesByRule: allMatches };
}

interface StringFieldAccessor {
  value: string;
  setter: (v: string) => void;
}

function extractStringFields(event: AIFREvent): StringFieldAccessor[] {
  const fields: StringFieldAccessor[] = [];

  switch (event.type) {
    case 'prompt':
      fields.push({ value: (event as PromptEvent).content, setter: v => { (event as PromptEvent).content = v; } });
      break;
    case 'command':
      fields.push({ value: (event as CommandEvent).command, setter: v => { (event as CommandEvent).command = v; } });
      if ((event as CommandEvent).stdout) fields.push({ value: (event as CommandEvent).stdout!, setter: v => { (event as CommandEvent).stdout = v; } });
      if ((event as CommandEvent).stderr) fields.push({ value: (event as CommandEvent).stderr!, setter: v => { (event as CommandEvent).stderr = v; } });
      break;
    case 'tool':
      for (const [k, v] of Object.entries((event as ToolEvent).input)) {
        if (typeof v === 'string') fields.push({ value: v, setter: nv => { ((event as ToolEvent).input as Record<string, unknown>)[k] = nv; } });
      }
      if ((event as ToolEvent).output) {
        for (const [k, v] of Object.entries((event as ToolEvent).output!)) {
          if (typeof v === 'string') fields.push({ value: v, setter: nv => { ((event as ToolEvent).output as Record<string, unknown>)[k] = nv; } });
        }
      }
      break;
    case 'terminal_output':
      fields.push({ value: (event as TerminalOutputEvent).content, setter: v => { (event as TerminalOutputEvent).content = v; } });
      break;
  }

  return fields;
}

export function redactEvents(events: AIFREvent[], rules?: RedactionRule[]): RedactionResult & { events: AIFREvent[] } {
  let totalRedacted = 0;
  const matchesByRule: Record<string, number> = {};
  const redactedEvents: AIFREvent[] = [];

  for (const event of events) {
    const { event: redacted, redactedCount, matchesByRule: ruleMatches } = redactEvent(event, rules);
    redactedEvents.push(redacted);
    totalRedacted += redactedCount;
    for (const [rule, count] of Object.entries(ruleMatches)) {
      matchesByRule[rule] = (matchesByRule[rule] ?? 0) + count;
    }
  }

  return { events: redactedEvents, totalScanned: events.length, totalRedacted, matchesByRule };
}

export function getDefaultRules(): RedactionRule[] {
  return DEFAULT_RULES.map(r => ({ ...r, pattern: new RegExp(r.pattern.source, r.pattern.flags) }));
}
