import { describe, it, expect } from 'vitest';
import { importCSV, importJSON } from '../src/core/importers.js';

describe('task importers', () => {
  it('parses a TickTick-style CSV', () => {
    const csv = `List Name,Title,Content,Priority,Due Date,Status\nInbox,Buy milk,"remember oat",0,2026-04-30,0\nInbox,Call mum,,1,,0`;
    const r = importCSV(csv);
    expect(r.tasks).toHaveLength(2);
    expect(r.tasks[0].name).toBe('Buy milk');
    expect(r.tasks[0].priority).toBe('high');
    expect(r.tasks[0].due).toBe('2026-04-30');
    expect(r.tasks[0].projectName).toBe('Inbox');
  });

  it('parses a Todoist-style JSON array', () => {
    const json = JSON.stringify([
      { content: 'Draft outline', priority: 2, due: { date: '2026-05-01' }, project: 'Book' },
      { content: 'Send email', completed: true },
    ]);
    const r = importJSON(json);
    expect(r.tasks).toHaveLength(2);
    expect(r.tasks[0].name).toBe('Draft outline');
    expect(r.tasks[0].due).toBe('2026-05-01');
    expect(r.tasks[1].done).toBe(true);
  });

  it('handles quoted commas and newlines in CSV fields', () => {
    const csv = `name,notes\n"Write, carefully","line1\nline2"`;
    const r = importCSV(csv);
    expect(r.tasks).toHaveLength(1);
    expect(r.tasks[0].name).toBe('Write, carefully');
    expect(r.tasks[0].notes).toContain('line1');
    expect(r.tasks[0].notes).toContain('line2');
  });
});
