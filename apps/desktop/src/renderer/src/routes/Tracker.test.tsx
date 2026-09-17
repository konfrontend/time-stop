// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harness, renderWith, type Harness } from '@/test/harness';
import { seedProject, seedRecord } from '@/test/fixtures';
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

const dial = () => screen.getByRole('button', { name: /^(Start|Pause|Continue)\b/ });

describe('Tracker', () => {
  it('starts a Timer from the dial and leaves one running in the database', async () => {
    renderWith(<Tracker />);

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Build header' } });
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' });

    await waitFor(async () =>
      expect(await h.api.record.getTimer()).toMatchObject({ name: 'Build header', stop: null }),
    );
    await waitFor(() => expect(dial().getAttribute('data-running')).toBe('true'));
  });

  it('stops the running Timer from the dial', async () => {
    await h.api.record.startTimer();
    renderWith(<Tracker />);

    await waitFor(() => expect(dial().getAttribute('data-running')).toBe('true'));
    fireEvent.click(dial());

    await waitFor(async () => expect(await h.api.record.getTimer()).toBeNull());
  });

  it('follows a Timer the main process reports, without asking for it', async () => {
    renderWith(<Tracker />);
    await waitFor(() => expect(dial().getAttribute('data-running')).toBeNull());

    const started = await h.api.record.startTimer();
    h.emit.timerChanged({ ...started, name: 'Elsewhere' });

    expect(await screen.findByRole('button', { name: /^Pause Elsewhere$/ })).toBeTruthy();
  });

  it('lists what was tracked today', async () => {
    const project = await seedProject(h, { name: 'Old work' });
    await seedRecord(h, { project, name: 'Fix footer' });
    renderWith(<Tracker />);

    expect(await screen.findByDisplayValue('Fix footer')).toBeTruthy();
  });
});
