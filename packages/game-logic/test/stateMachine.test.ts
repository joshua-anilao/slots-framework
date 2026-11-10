import { describe, expect, it } from 'vitest';
import { AutoSpinModel, ConnectionModel, SpinModel, StateMachine } from '../src';

describe('StateMachine', () => {
  it('moves on allowed events and refuses the rest', () => {
    const m = new StateMachine<'a' | 'b', 'go' | 'back'>('a', { a: { go: 'b' }, b: { back: 'a' } });
    expect(m.can('back')).toBe(false);
    expect(m.send('back')).toBe(false);
    expect(m.is('a')).toBe(true);
    expect(m.send('go')).toBe(true);
    expect(m.state.value).toBe('b');
  });

  it('spin flow cannot start twice or skip steps', () => {
    const s = new SpinModel();
    expect(s.machine.send('done')).toBe(false);
    expect(s.machine.send('request')).toBe(true);
    expect(s.isBusy).toBe(true);
    expect(s.machine.send('request')).toBe(false);
    expect(s.machine.send('present')).toBe(true);
    expect(s.machine.send('done')).toBe(true);
    expect(s.phase.value).toBe('idle');
  });

  it('auto spin: active is false as soon as stop is pressed, and back to idle on finish', () => {
    const a = new AutoSpinModel();
    a.machine.send('start');
    expect(a.active.value).toBe(true);
    a.machine.send('stop');
    expect(a.active.value).toBe(false);
    expect(a.machine.is('stopping')).toBe(true);
    expect(a.machine.send('start')).toBe(false);
    a.machine.send('finish');
    expect(a.machine.is('idle')).toBe(true);
  });

  it('connection goes offline and back', () => {
    const c = new ConnectionModel();
    expect(c.machine.send('restored')).toBe(false);
    c.machine.send('lost');
    expect(c.machine.state.value).toBe('offline');
    c.machine.send('restored');
    expect(c.machine.state.value).toBe('online');
  });
});
