import { describe, expect, it } from 'vitest';

import { parseCommand } from '../src/proxy/commands.js';

describe('parseCommand', () => {
  it('returns null for ordinary messages', () => {
    expect(parseCommand('what is the memory usage?', '/memory')).toBeNull();
    expect(parseCommand('tell me about /memory', '/memory')).toBeNull();
  });

  it('requires a word break so similar words are not swallowed', () => {
    expect(parseCommand('/memoryleak explain this', '/memory')).toBeNull();
  });

  it('parses the bare command as help', () => {
    expect(parseCommand('/memory', '/memory')).toEqual({ name: '', rest: '' });
  });

  it('parses a subcommand', () => {
    expect(parseCommand('/memory off', '/memory')).toEqual({ name: 'off', rest: '' });
    expect(parseCommand('  /Memory  STATUS  ', '/memory')).toEqual({ name: 'status', rest: '' });
  });

  it('keeps the remainder intact for save and search', () => {
    expect(parseCommand('/memory save the NAS is on 10.0.0.4', '/memory')).toEqual({
      name: 'save',
      rest: 'the NAS is on 10.0.0.4',
    });
  });

  it('honours a custom prefix', () => {
    expect(parseCommand('!mem status', '!mem')).toEqual({ name: 'status', rest: '' });
    expect(parseCommand('/memory status', '!mem')).toBeNull();
  });
});
