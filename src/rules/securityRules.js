export const PROMPT_INJECTION_PATTERNS = [
  "ignore previous instructions",
  "ignore all instructions",
  "system prompt",
  "developer message",
  "do not tell the accountant",
  "send this automatically",
  "approve without review"
];

export const DEFAULT_PRIVATE_PARTY_TERMS = [
  "Private Client",
  "Real Client",
  "Named Person",
  "Named Firm"
];

export function findPromptInjection(text) {
  const lower = String(text || "").toLowerCase();
  return PROMPT_INJECTION_PATTERNS.find((pattern) => lower.includes(pattern)) || null;
}

export function buildPromptInjectionTaint(text) {
  const matchedPattern = findPromptInjection(text);
  if (!matchedPattern) return null;

  return {
    promptInjectionSuspected: true,
    instructionFollowingForbidden: true,
    matchedPattern
  };
}

export function validatePrivacyForExport(value, privatePartyTerms = DEFAULT_PRIVATE_PARTY_TERMS) {
  const text = JSON.stringify(value || {});
  const issues = [];

  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) {
    issues.push({ id: "email_address", message: "Email address pattern detected." });
  }

  if (/\b(api[_-]?key|access[_-]?token|password|secret|private key)\b["']?\s*[:=]/i.test(text)) {
    issues.push({ id: "credential_like_text", message: "Credential-like text detected." });
  }

  if (/\bCH\d{2}(?:[ -]?[A-Z0-9]){11,30}\b/i.test(text)) {
    issues.push({ id: "iban_identifier", message: "IBAN-shaped identifier detected." });
  }

  if (/\bCHE[- ]?\d{3}[- .]?\d{3}[- .]?\d{3}\b/i.test(text)) {
    issues.push({ id: "swiss_uid_identifier", message: "Swiss UID-shaped identifier detected." });
  }

  if (/(?:\+41|0041|0)\s?(?:\(0\)\s?)?(?:\d[\s.-]?){8,12}\b/i.test(text)) {
    issues.push({ id: "swiss_phone_number", message: "Swiss phone-number-like pattern detected." });
  }

  if (/\b756[-. ]?\d{4}[-. ]?\d{4}[-. ]?\d{2}\b/i.test(text)) {
    issues.push({ id: "swiss_ahv_identifier", message: "Swiss AHV-like identifier detected." });
  }

  if (
    /\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüéèàÉÈÀß.-]*(?:strasse|straße|gasse|weg|platz|allee|ring|quai)\s+\d+[A-Za-z]?\s*,?\s*[1-9]\d{3}\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüéèàÉÈÀß.-]+\b/i.test(
      text
    )
  ) {
    issues.push({ id: "swiss_address_like_text", message: "Swiss address-like pattern detected." });
  }

  const lowerText = text.toLowerCase();
  for (const term of privatePartyTerms) {
    if (term && lowerText.includes(String(term).toLowerCase())) {
      issues.push({ id: "configured_private_party_term", message: "Configured private-party term detected." });
      break;
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
