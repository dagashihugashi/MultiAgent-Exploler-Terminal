/**
 * Shell integration (Design-doc 3.4.3): the PowerShell prompt emits
 *   OSC 133;A  -> a prompt is being shown (pane is idle)
 *   OSC 9;9;<path> -> the current directory
 * This module parses those payloads and reads the last visible output line.
 */

export const OSC_PROMPT = 133;
export const OSC_CONEMU = 9;
export const LAST_LINE_MAX_LENGTH = 80;
const LAST_LINE_SCAN_LIMIT = 200;

/** True when an OSC 133 payload marks the start of a prompt ("A" or "A;..."). */
export function isPromptStart(payload: string): boolean {
  return payload === "A" || payload.startsWith("A;");
}

/** Extracts the directory from an OSC 9 payload of the form "9;<path>". */
export function parseCwd(payload: string): string | null {
  if (!payload.startsWith("9;")) return null;
  const path = payload.slice(2).trim();
  return path.length > 0 ? path : null;
}

export interface BufferLineLike {
  translateToString(trimRight?: boolean): string;
}

export interface BufferLike {
  baseY: number;
  cursorY: number;
  getLine(index: number): BufferLineLike | undefined;
}

/** Last non-empty line at or above the cursor, truncated for display. */
export function lastNonEmptyLine(buffer: BufferLike): string {
  const start = buffer.baseY + buffer.cursorY;
  const stop = Math.max(0, start - LAST_LINE_SCAN_LIMIT);
  for (let index = start; index >= stop; index -= 1) {
    const text = buffer.getLine(index)?.translateToString(true).trim() ?? "";
    if (text.length > 0) return text.slice(0, LAST_LINE_MAX_LENGTH);
  }
  return "";
}
