/**
 * Splits a streaming text buffer into emittable sentence chunks.
 *
 * Rules:
 * - Emit on sentence terminators (. ! ? …) when followed by whitespace OR EOS.
 * - Don't emit inside ellipses mid-word (e.g., "Mr." false-triggers). We don't
 *   have titles in this coach, so a naive terminator + space is fine.
 * - Shorter mid-clauses are fine too — if we see a comma and the tail is >40
 *   characters, flush to keep audio moving. (Keeps perceived latency low.)
 */

export type EmittedChunk = {
  text: string;
  trailingPauseMs: number;
};

const SENTENCE_END = /[.!?…]["')\]]?\s/;
const COMMA_FLUSH = /,\s/;

export function createSentenceSplitter() {
  let buffer = "";

  return {
    push(tokens: string): EmittedChunk[] {
      buffer += tokens;
      const out: EmittedChunk[] = [];
      let match: RegExpExecArray | null;
      while ((match = SENTENCE_END.exec(buffer))) {
        const end = match.index + match[0].length;
        const chunk = buffer.slice(0, end).trim();
        buffer = buffer.slice(end);
        if (chunk) out.push({ text: chunk, trailingPauseMs: 350 });
      }
      // Flush long mid-sentence clauses at commas so audio keeps moving.
      if (buffer.length > 80) {
        const commaMatch = COMMA_FLUSH.exec(buffer);
        if (commaMatch && commaMatch.index > 40) {
          const end = commaMatch.index + commaMatch[0].length;
          const chunk = buffer.slice(0, end).trim();
          buffer = buffer.slice(end);
          if (chunk) out.push({ text: chunk, trailingPauseMs: 180 });
        }
      }
      return out;
    },
    flush(): EmittedChunk[] {
      const tail = buffer.trim();
      buffer = "";
      if (!tail) return [];
      return [{ text: tail, trailingPauseMs: 0 }];
    },
  };
}
