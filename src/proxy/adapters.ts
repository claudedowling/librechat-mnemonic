import { injectSystemMessage, messageText, type SimpleMessage } from './inject.js';

/**
 * The two wire formats LibreChat can point at a custom endpoint.
 *
 * `provider: anthropic` custom endpoints use the native Messages API, which
 * carries the system prompt in a top-level `system` field rather than as a
 * message. Everything else in LibreChat speaks OpenAI-compatible.
 */
export type WireFormat = 'openai' | 'anthropic';

export interface ChatAdapter {
  /** Messages used to build the recall query. */
  conversation(body: Record<string, unknown>): SimpleMessage[];
  /** Return a new body with the memory block added. */
  inject(body: Record<string, unknown>, block: string): Record<string, unknown>;
  /** Pull the assistant's text out of a non-streaming response. */
  responseText(json: unknown): string;
  /** Pull assistant text out of one parsed SSE data payload. */
  streamDelta(event: unknown): string;
}

export const openaiAdapter: ChatAdapter = {
  conversation(body) {
    const messages = Array.isArray(body.messages) ? (body.messages as SimpleMessage[]) : [];
    return messages;
  },

  inject(body, block) {
    const messages = Array.isArray(body.messages) ? (body.messages as SimpleMessage[]) : [];
    const next = injectSystemMessage(messages, block, (content) => ({
      role: 'system',
      content,
    }));
    return { ...body, messages: next };
  },

  responseText(json) {
    const choices = (json as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
    return messageText(choices?.[0]?.message?.content);
  },

  streamDelta(event) {
    const choices = (event as { choices?: Array<{ delta?: { content?: unknown } }> }).choices;
    const content = choices?.[0]?.delta?.content;
    return typeof content === 'string' ? content : '';
  },
};

export const anthropicAdapter: ChatAdapter = {
  conversation(body) {
    const messages = Array.isArray(body.messages) ? (body.messages as SimpleMessage[]) : [];
    return messages;
  },

  inject(body, block) {
    const system = body.system;

    if (typeof system === 'string') {
      if (system.includes(block.slice(0, 40))) return body;
      return { ...body, system: `${system}\n\n${block}` };
    }

    if (Array.isArray(system)) {
      return { ...body, system: [...system, { type: 'text', text: block }] };
    }

    return { ...body, system: block };
  },

  responseText(json) {
    const content = (json as { content?: Array<{ type?: string; text?: string }> }).content;
    if (!Array.isArray(content)) return '';
    return content
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string)
      .join('');
  },

  streamDelta(event) {
    const typed = event as { type?: string; delta?: { type?: string; text?: unknown } };
    if (typed.type === 'content_block_delta' && typeof typed.delta?.text === 'string') {
      return typed.delta.text;
    }
    return '';
  },
};

export function adapterFor(format: WireFormat): ChatAdapter {
  return format === 'anthropic' ? anthropicAdapter : openaiAdapter;
}

/** Pull assistant text out of a raw SSE body, tolerating partial frames. */
export function collectStreamText(buffer: string, adapter: ChatAdapter): string {
  let text = '';
  for (const line of buffer.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      text += adapter.streamDelta(JSON.parse(payload));
    } catch {
      // Partial or non-JSON frame; skip it.
    }
  }
  return text;
}
