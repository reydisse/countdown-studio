const CUE_RE   = /^\[CUE:\s*(.+?)\]$/i;
const BOLD_RE  = /\*\*(.+?)\*\*/g;
const BREAK_RE = /^---+$/;

export function parseScript(raw = '') {
  const lines    = raw.split('\n');
  const segments = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (BREAK_RE.test(trimmed)) {
      segments.push({ type: 'break' });
      continue;
    }

    const cueMatch = CUE_RE.exec(trimmed);
    if (cueMatch) {
      segments.push({ type: 'cue', label: cueMatch[1] });
      continue;
    }

    if (trimmed === '') {
      segments.push({ type: 'blank' });
      continue;
    }

    const inlineSegments = [];
    let lastIndex = 0;
    let match;
    BOLD_RE.lastIndex = 0;

    while ((match = BOLD_RE.exec(line)) !== null) {
      if (match.index > lastIndex) {
        inlineSegments.push({ bold: false, text: line.slice(lastIndex, match.index) });
      }
      inlineSegments.push({ bold: true, text: match[1] });
      lastIndex = BOLD_RE.lastIndex;
    }

    if (lastIndex < line.length) {
      inlineSegments.push({ bold: false, text: line.slice(lastIndex) });
    }

    segments.push({ type: 'line', spans: inlineSegments });
  }

  return segments;
}
