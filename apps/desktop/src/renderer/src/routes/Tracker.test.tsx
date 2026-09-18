// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harness, renderWith, type Harness } from '@/test/harness';
import { recentRows, seedProject, seedRecord } from '@/test/fixtures';
import { Tracker } from './Tracker';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

let h: Harness;

beforeEach(async () => {
  h = harness();
  const project = await seedProject(h, { name: 'Website redesign' });
  await h.api.context.set({ workspaceId: h.workspace.id, projectId: project.id });
});
afterEach(cleanup);

const pause = () => screen.findByRole('button', { name: /^Pause\b/ });

describe('Tracker', () => {
  it('starts a Timer from the dial and leaves one running in the database', async () => {
    renderWith(<Tracker />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Build header' } });
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' });

    await waitFor(async () =>
      expect(await h.api.record.getTimer()).toMatchObject({ name: 'Build header', stop: null }),
    );
    expect(await pause()).toBeTruthy();
  });

  it('stops the running Timer from the dial', async () => {
    await h.api.record.startTimer();
    renderWith(<Tracker />);

    fireEvent.click(await pause());

    await waitFor(async () => expect(await h.api.record.getTimer()).toBeNull());
  });

  it('renames the running Timer as it is typed, after a pause', async () => {
    const started = await h.api.record.startTimer();
    renderWith(<Tracker />);
    await pause();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Build header' } });

    await waitFor(async () =>
      expect(await h.api.record.getTimer()).toMatchObject({ id: started.id, name: 'Build header' }),
    );
  });

  it('follows a Timer the main process reports, without asking for it', async () => {
    renderWith(<Tracker />);
    await screen.findByRole('button', { name: /^(Start|Continue)\b/ });

    const started = await h.api.record.startTimer();
    h.emit.timerChanged({ ...started, name: 'Elsewhere' });

    expect(await screen.findByRole('button', { name: /^Pause Elsewhere$/ })).toBeTruthy();
  });

  it('continues a listed Record as one start: its Name and Project, with the Context moved', async () => {
    const old = await seedProject(h, { name: 'Old work' });
    await seedRecord(h, { project: old, name: 'Fix footer' });
    await h.api.record.startTimer({ name: 'Build header' });
    renderWith(<Tracker />);
    await pause();

    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    await waitFor(async () =>
      expect(await h.api.record.getTimer()).toMatchObject({
        name: 'Fix footer',
        projectId: old.id,
        stop: null,
      }),
    );
    expect(await h.api.context.get()).toMatchObject({ projectId: old.id });
    const rows = await recentRows(h);
    expect(rows.find((row) => row.record.name === 'Build header')?.record.stop).not.toBeNull();
  });

  it('lists what was tracked today', async () => {
    const project = await seedProject(h, { name: 'Old work' });
    await seedRecord(h, { project, name: 'Fix footer' });
    renderWith(<Tracker />);

    expect(await screen.findByDisplayValue('Fix footer')).toBeTruthy();
  });
});
