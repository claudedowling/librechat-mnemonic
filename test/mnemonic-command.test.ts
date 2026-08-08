import { describe, expect, it } from 'vitest';

import { resolveMnemonicCommand } from '../src/config.js';

describe('resolveMnemonicCommand', () => {
  it('honours an explicit command verbatim', () => {
    expect(resolveMnemonicCommand('/usr/local/bin/mnemonic')).toEqual({
      command: '/usr/local/bin/mnemonic',
      args: [],
    });
  });

  it('finds the bundled mnemonic and spawns it with the current node binary', () => {
    // node_modules/.bin is not on PATH when the process is started directly,
    // so resolving the entrypoint is the only reliable route.
    const resolved = resolveMnemonicCommand(undefined);
    expect(resolved.command).toBe(process.execPath);
    expect(resolved.args[0]).toMatch(/mnemonic-mcp[/\\]build[/\\]index\.js$/);
  });
});
