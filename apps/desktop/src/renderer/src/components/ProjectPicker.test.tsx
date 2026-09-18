// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { aProject } from '@/test/fixtures';
import { ProjectPicker } from './ProjectPicker';

const projects = [
  aProject({ id: 'p1', name: 'Acme API' }),
  aProject({ id: 'p2', name: 'Old site', archived: true }),
  aProject({ id: 'p3', name: 'Legacy app', archived: true }),
];

async function open(props: Partial<React.ComponentProps<typeof ProjectPicker>> = {}) {
  render(
    <ProjectPicker
      workspaceId="w1"
      projects={projects}
      creatable={false}
      onChange={() => {}}
      {...props}
    >
      <button type="button">Pick</button>
    </ProjectPicker>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Pick' }));
  await screen.findByRole('option', { name: /Acme API/ });
}

const offered = (name: RegExp) => screen.queryByRole('option', { name }) !== null;

afterEach(cleanup);

describe('ProjectPicker', () => {
  it('leaves Archived Projects out', async () => {
    await open({ value: 'p1' });
    expect(offered(/Old site/)).toBe(false);
    expect(offered(/Legacy app/)).toBe(false);
  });

  it('keeps the Archived Project the value already names', async () => {
    await open({ value: 'p2' });
    expect(offered(/Old site/)).toBe(true);
    expect(offered(/Legacy app/)).toBe(false);
  });

  it('offers every Project where Archived ones are shown', async () => {
    await open({ value: null, showArchived: true });
    expect(offered(/Old site/)).toBe(true);
    expect(offered(/Legacy app/)).toBe(true);
  });
});
