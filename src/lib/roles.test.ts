import { describe, expect, test } from 'bun:test';
import { mayChange } from './roles';

describe('mayChange', () => {
  const me = 'helper@example.com';
  test('admins and members change anything', () => {
    expect(mayChange('admin', 'a@example.com', { by: me })).toBe(true);
    expect(mayChange('member', 'b@example.com', { by: me })).toBe(true);
  });
  test('helpers and kids change only what they added', () => {
    expect(mayChange('helper', me, { by: me })).toBe(true);
    expect(mayChange('helper', me, { by: 'a@example.com' })).toBe(false);
    expect(mayChange('kid', me, {})).toBe(false);
    expect(mayChange(null, me, { by: me })).toBe(true);
    expect(mayChange(null, '', {})).toBe(false);
  });
});
