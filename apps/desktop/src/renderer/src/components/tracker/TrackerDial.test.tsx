// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project, Workspace } from '@time-stop/domain';
import { harness, renderWith } from '@/test/harness';
import { seedProject } from '@/test/fixtures';
import { TrackerDial } from './TrackerDial';

const handlers = { onSubmit: vi.fn(), onClear: vi.fn(), onToggle: vi.fn(), onPick: vi.fn() };

let workspace: Workspace;
let project: Project;

function Dial({
  standby = 'start' as 'start' | 'continue',
  name = '',
}: {
  standby?: 'start' | 'continue';
  name?: string;
}) {
  const [draft, setDraft] = useState(name);
  return (
    <TrackerDial
      workspace={workspace}
      projects={[project]}
      project={project}
      projectId={project.id}
      timer={null}
      elapsed="00:00:00"
      elapsedMs={0}
      standby={standby}
      name={draft}
      activityTodayMs={3 * 3_600_000 + 45 * 60_000}
      pending={false}
      onDraftChange={setDraft}
      onSubmit={handlers.onSubmit}
      onClear={() => {
        handlers.onClear();
        setDraft('');
      }}
      onPickProject={handlers.onPick}
      onToggle={handlers.onToggle}
    />
  );
}

beforeEach(async () => {
  const h = harness();
  workspace = await h.api.workspace.update({
    id: h.workspace.id,
    name: 'Work',
    currency: 'USD',
    color: '#4f6bd9',
  });
  project = await seedProject(h, { name: 'Website redesign', rate: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TrackerDial', () => {
  it('starts what was typed on Enter, without the mouse', () => {
    renderWith(<Dial />);
    const name = screen.getByLabelText('Name');
    fireEvent.change(name, { target: { value: 'Build header' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(handlers.onSubmit).toHaveBeenCalledExactlyOnceWith('Build header');
  });

  it('prints the Project abbreviation and its colour outside the ring', () => {
    renderWith(<Dial />);
    expect(screen.getByText('WR')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Project: Website redesign' })).toBeTruthy();
  });

  it("prints the activity's total today beside Clear, and clears back to an empty Name", () => {
    renderWith(<Dial standby="continue" name="Build header" />);
    expect(screen.getByText('3:45 today')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(handlers.onClear).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Name')).toHaveProperty('value', '');
    expect(document.activeElement).toBe(screen.getByLabelText('Name'));
  });

  it('offers Clear only once there is something to let go of', () => {
    renderWith(<Dial />);
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'B' } });
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
  });
});
