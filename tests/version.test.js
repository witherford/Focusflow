import { describe, it, expect } from 'vitest';
import { bumpVersion, APP_VERSION } from '../src/core/version.js';

describe('version', () => {
  it('starts at 1.0.0', () => {
    expect(APP_VERSION).toBe('1.0.0');
  });
  it('bumps patch by 1', () => {
    expect(bumpVersion('1.0.0')).toBe('1.0.1');
    expect(bumpVersion('1.0.5')).toBe('1.0.6');
  });
  it('rolls patch >= 10 to next minor', () => {
    expect(bumpVersion('1.0.9')).toBe('1.1.0');
  });
  it('rolls minor >= 10 to next major', () => {
    expect(bumpVersion('1.9.9')).toBe('2.0.0');
  });
  it('accepts a leading V', () => {
    expect(bumpVersion('V2.3.4')).toBe('2.3.5');
  });
});
