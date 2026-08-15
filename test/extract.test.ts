import { describe, expect, it } from 'vitest';

import { extractExplicit, parseCandidates } from '../src/memory/extract.js';

describe('extractExplicit', () => {
  it('catches the common phrasings', () => {
    expect(extractExplicit('remember that the NAS is on 10.0.0.4')[0]?.content).toBe(
      'the NAS is on 10.0.0.4',
    );
    expect(extractExplicit('Please remember: I prefer TypeScript')[0]?.content).toBe(
      'I prefer TypeScript',
    );
    expect(extractExplicit('note to self, renew the cert in March')[0]?.content).toBe(
      'renew the cert in March',
    );
    expect(extractExplicit("don't forget that Steve dislikes emdashes")[0]?.content).toBe(
      'Steve dislikes emdashes',
    );
  });

  it('derives a title from the first line', () => {
    const [candidate] = extractExplicit('remember that A happened\nand then B happened');
    expect(candidate?.title).toBe('A happened');
    expect(candidate?.content).toContain('B happened');
  });

  it('ignores messages that merely mention remembering', () => {
    expect(extractExplicit('do you remember what I said?')).toEqual([]);
    expect(extractExplicit('I cannot remember the port number')).toEqual([]);
  });
});

describe('parseCandidates', () => {
  it('parses a clean response', () => {
    const raw = '{"memories":[{"title":"T","content":"C","tags":["a"],"lifecycle":"permanent"}]}';
    expect(parseCandidates(raw, 3)).toEqual([
      { title: 'T', content: 'C', tags: ['a'], lifecycle: 'permanent', role: 'context' },
    ]);
  });

  it('unwraps fenced JSON', () => {
    const raw = 'Sure!\n```json\n{"memories":[{"title":"T","content":"C"}]}\n```\n';
    expect(parseCandidates(raw, 3)).toHaveLength(1);
  });

  it('finds JSON embedded in prose', () => {
    const raw = 'Here you go: {"memories":[{"title":"T","content":"C"}]} Hope that helps.';
    expect(parseCandidates(raw, 3)).toHaveLength(1);
  });

  it('returns nothing for the empty case', () => {
    expect(parseCandidates('{"memories":[]}', 3)).toEqual([]);
    expect(parseCandidates('', 3)).toEqual([]);
    expect(parseCandidates('no json at all', 3)).toEqual([]);
    expect(parseCandidates('{ broken', 3)).toEqual([]);
  });

  it('drops entries missing a title or content instead of storing junk', () => {
    const raw =
      '{"memories":[{"title":"","content":"C"},{"title":"T"},{"title":"T2","content":"C2"}]}';
    expect(parseCandidates(raw, 5)).toEqual([
      { title: 'T2', content: 'C2', tags: [], lifecycle: 'permanent', role: 'context' },
    ]);
  });

  it('enforces the per-turn cap', () => {
    const memories = Array.from({ length: 10 }, (_, i) => ({ title: `T${i}`, content: 'C' }));
    expect(parseCandidates(JSON.stringify({ memories }), 3)).toHaveLength(3);
  });

  it('defaults lifecycle to permanent and honours temporary', () => {
    expect(parseCandidates('{"memories":[{"title":"T","content":"C"}]}', 3)[0]?.lifecycle).toBe(
      'permanent',
    );
    expect(
      parseCandidates('{"memories":[{"title":"T","content":"C","lifecycle":"temporary"}]}', 3)[0]
        ?.lifecycle,
    ).toBe('temporary');
  });

  it('clamps oversized fields and tag lists', () => {
    const raw = JSON.stringify({
      memories: [
        {
          title: 'x'.repeat(500),
          content: 'y'.repeat(20000),
          tags: Array.from({ length: 20 }, (_, i) => `t${i}`),
        },
      ],
    });
    const [candidate] = parseCandidates(raw, 3);
    expect(candidate?.title).toHaveLength(120);
    expect(candidate?.content).toHaveLength(8000);
    expect(candidate?.tags).toHaveLength(6);
  });

  it('ignores non-string tags rather than passing them to mnemonic', () => {
    const raw = '{"memories":[{"title":"T","content":"C","tags":["ok",5,null,"  "]}]}';
    expect(parseCandidates(raw, 3)[0]?.tags).toEqual(['ok']);
  });

  it('defaults role to context and honours valid roles', () => {
    expect(parseCandidates('{"memories":[{"title":"T","content":"C"}]}', 3)[0]?.role).toBe(
      'context',
    );
    expect(
      parseCandidates('{"memories":[{"title":"T","content":"C","role":"decision"}]}', 3)[0]?.role,
    ).toBe('decision');
  });

  it('falls back to context for invalid roles', () => {
    const raw = '{"memories":[{"title":"T","content":"C","role":"bogus"}]}';
    expect(parseCandidates(raw, 3)[0]?.role).toBe('context');
  });
});
