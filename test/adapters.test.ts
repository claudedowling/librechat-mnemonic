import { describe, expect, it } from 'vitest';

import {
  adapterFor,
  anthropicAdapter,
  collectStreamText,
  openaiAdapter,
} from '../src/proxy/adapters.js';

describe('openai adapter', () => {
  it('injects a system message after existing system messages', () => {
    const body = {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'rules' },
        { role: 'user', content: 'hi' },
      ],
    };
    const next = openaiAdapter.inject(body, 'BLOCK') as typeof body;
    expect(next.messages.map((m) => m.role)).toEqual(['system', 'system', 'user']);
    expect(next.messages[1]?.content).toBe('BLOCK');
    // Original untouched.
    expect(body.messages).toHaveLength(2);
  });

  it('reads the assistant reply from a completion', () => {
    expect(
      openaiAdapter.responseText({
        choices: [{ message: { role: 'assistant', content: 'the answer' } }],
      }),
    ).toBe('the answer');
  });

  it('reads deltas from stream chunks', () => {
    expect(openaiAdapter.streamDelta({ choices: [{ delta: { content: 'ab' } }] })).toBe('ab');
    expect(openaiAdapter.streamDelta({ choices: [{ delta: {} }] })).toBe('');
  });
});

describe('anthropic adapter', () => {
  it('appends to a string system prompt', () => {
    const next = anthropicAdapter.inject({ system: 'rules', messages: [] }, 'BLOCK') as {
      system: string;
    };
    expect(next.system).toBe('rules\n\nBLOCK');
  });

  it('appends a text block to an array system prompt', () => {
    const next = anthropicAdapter.inject(
      { system: [{ type: 'text', text: 'rules' }], messages: [] },
      'BLOCK',
    ) as { system: Array<{ type: string; text: string }> };
    expect(next.system).toHaveLength(2);
    expect(next.system[1]).toEqual({ type: 'text', text: 'BLOCK' });
  });

  it('sets the system prompt when there was none', () => {
    const next = anthropicAdapter.inject({ messages: [] }, 'BLOCK') as { system: string };
    expect(next.system).toBe('BLOCK');
  });

  it('reads text out of a messages response', () => {
    expect(
      anthropicAdapter.responseText({
        content: [
          { type: 'thinking', thinking: 'ignored' },
          { type: 'text', text: 'the ' },
          { type: 'text', text: 'answer' },
        ],
      }),
    ).toBe('the answer');
  });

  it('reads only text deltas from the stream', () => {
    expect(
      anthropicAdapter.streamDelta({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'ab' },
      }),
    ).toBe('ab');
    expect(anthropicAdapter.streamDelta({ type: 'message_start' })).toBe('');
  });
});

describe('collectStreamText', () => {
  it('reassembles an openai SSE body', () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":" world"}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    expect(collectStreamText(sse, openaiAdapter)).toBe('Hello world');
  });

  it('reassembles an anthropic SSE body including event lines', () => {
    const sse = [
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ].join('\n');
    expect(collectStreamText(sse, anthropicAdapter)).toBe('Hi');
  });

  it('ignores truncated or malformed frames rather than throwing', () => {
    const sse = 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: {"choices":[{"del';
    expect(collectStreamText(sse, openaiAdapter)).toBe('ok');
  });
});

describe('adapterFor', () => {
  it('maps the wire format', () => {
    expect(adapterFor('anthropic')).toBe(anthropicAdapter);
    expect(adapterFor('openai')).toBe(openaiAdapter);
  });
});
