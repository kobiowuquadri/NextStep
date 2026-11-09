import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  formatMinutes,
  instantAt,
  localDateKey,
  tzOffsetMinutes,
  weekStartKey,
  weekdayOfKey,
  zonedParts,
  zonedTimeToUtc,
} from './time';
import { canonicalJson, stableUuid } from './ids';
import { Task, classifyConcurrentChange } from './index';

describe('timezone helpers', () => {
  it('Africa/Lagos is UTC+1 all year (no DST)', () => {
    expect(tzOffsetMinutes(Date.UTC(2026, 0, 15), 'Africa/Lagos')).toBe(60);
    expect(tzOffsetMinutes(Date.UTC(2026, 6, 15), 'Africa/Lagos')).toBe(60);
  });

  it('converts Lagos wall-clock to UTC', () => {
    const ms = zonedTimeToUtc(2026, 11, 13, 18, 0, 'Africa/Lagos');
    expect(new Date(ms).toISOString()).toBe('2026-11-13T17:00:00.000Z');
  });

  it('handles the late-night day boundary in Lagos', () => {
    // 23:30 UTC on 12 Nov is 00:30 on 13 Nov in Lagos
    expect(localDateKey(Date.UTC(2026, 10, 12, 23, 30), 'Africa/Lagos')).toBe('2026-11-13');
  });

  it('handles DST spring-forward gaps (America/New_York, 8 Mar 2026)', () => {
    // 02:30 does not exist; resolve forward to 03:30 EDT = 07:30Z
    const ms = zonedTimeToUtc(2026, 3, 8, 2, 30, 'America/New_York');
    const p = zonedParts(ms, 'America/New_York');
    expect(p.hour).toBe(3);
    expect(new Date(ms).toISOString()).toBe('2026-03-08T07:30:00.000Z');
  });

  it('handles DST fall-back ambiguity by choosing the earlier instant', () => {
    // 01:30 happens twice on 1 Nov 2026 in New York; earlier is EDT (05:30Z)
    const ms = zonedTimeToUtc(2026, 11, 1, 1, 30, 'America/New_York');
    expect(new Date(ms).toISOString()).toBe('2026-11-01T05:30:00.000Z');
  });

  it('computes instants for windows across timezones', () => {
    expect(new Date(instantAt('2026-11-10', '19:00', 'Europe/London')).toISOString()).toBe('2026-11-10T19:00:00.000Z');
    expect(new Date(instantAt('2026-11-10', '19:00', 'Asia/Kolkata')).toISOString()).toBe('2026-11-10T13:30:00.000Z');
    expect(new Date(instantAt('2026-11-10', '24:00', 'Africa/Lagos')).toISOString()).toBe('2026-11-10T23:00:00.000Z');
  });

  it('date-key arithmetic is timezone independent', () => {
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekdayOfKey('2026-11-13')).toBe(5);
    expect(weekStartKey(Date.UTC(2026, 10, 15, 12), 'Africa/Lagos')).toBe('2026-11-09');
  });

  it('formats durations', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(90)).toBe('1 h 30 min');
    expect(formatMinutes(120)).toBe('2 h');
  });
});

describe('stable ids', () => {
  it('is deterministic and UUID shaped', () => {
    const a = stableUuid('user', 'task', 123);
    expect(a).toBe(stableUuid('user', 'task', 123));
    expect(a).not.toBe(stableUuid('user', 'task', 124));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('canonical JSON ignores key order', () => {
    expect(canonicalJson({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe(canonicalJson({ a: [1, { c: 3, d: 2 }], b: 1 }));
  });
});

describe('entity schemas', () => {
  it('rejects a task without a title', () => {
    const r = Task.safeParse({ title: '' });
    expect(r.success).toBe(false);
  });
});

describe('concurrent change classification', () => {
  it('flags concurrent edits to important fields with different values', () => {
    const r = classifyConcurrentChange(
      'task',
      ['dueAt', 'title'],
      ['dueAt'],
      { dueAt: '2026-11-14T17:00:00Z', title: 'A' },
      { dueAt: '2026-11-15T17:00:00Z', title: 'B' },
    );
    expect(r.conflicting).toEqual(['dueAt']);
    expect(r.autoMerge).toEqual(['title']);
  });
  it('merges when both sides set the same value', () => {
    const r = classifyConcurrentChange('task', ['dueAt'], ['dueAt'], { dueAt: 'x' }, { dueAt: 'x' });
    expect(r.conflicting).toEqual([]);
  });
  it('last-writer-wins for unimportant fields', () => {
    const r = classifyConcurrentChange('task', ['title'], ['title'], { title: 'mine' }, { title: 'theirs' });
    expect(r.autoMerge).toEqual(['title']);
  });
});
