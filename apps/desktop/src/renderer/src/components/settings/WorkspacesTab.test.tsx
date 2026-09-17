// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectInput } from '@time-stop/db/testing';
import { PALETTE } from '@/lib/colors';
import { harness, renderWith } from '@/test/harness';
import { pickOption } from '@/test/pickOption';
import { WorkspacesTab } from './WorkspacesTab';

interface WorkspaceSpec {
  key: string;
  name: string;
  currency: string | null;
}
interface ClientSpec {
  key: string;
  workspaceKey: string;
  name: string;
}
interface ProjectSpec {
  key: string;
  workspaceKey: string;
  name: string;
  rate?: number | null;
  clientKey?: string;
}

const workspace = (key: string, name: string, currency: string | null = null): WorkspaceSpec => ({
  key,
  name,
  currency,
});

const client = (key: string, workspaceKey: string, name: string): ClientSpec => ({
  key,
  workspaceKey,
  name,
});

const project = (fields: {
  id: string;
  workspaceId: string;
  name: string;
  rate?: number | null;
  clientId?: string;
}): ProjectSpec => ({
  key: fields.id,
  workspaceKey: fields.workspaceId,
  name: fields.name,
  rate: fields.rate ?? null,
  ...(fields.clientId === undefined ? {} : { clientKey: fields.clientId }),
});

interface Given {
  workspace: { create: Spy; update: Spy; delete: Spy };
  client: { create: Spy; update: Spy; delete: Spy };
  project: { create: Spy; update: Spy; archive: Spy; unarchive: Spy; delete: Spy };
  /** The real id written for a spec key, so assertions name what the test seeded. */
  id(key: string): string;
}

type Spy = ReturnType<typeof vi.spyOn>;

/**
 * Writes the seed through the real api, then watches every member the tab calls. The first
 * Workspace of the seed is the one `bootstrap` already made, renamed.
 */
async function given(seed: {
  workspaces: WorkspaceSpec[];
  clients?: ClientSpec[];
  projects?: ProjectSpec[];
}): Promise<Given> {
  const h = harness();
  const ids = new Map<string, string>();

  const [first, ...rest] = seed.workspaces;
  if (first === undefined) throw new Error('Seed at least one Workspace');
  await h.api.workspace.update({
    id: h.workspace.id,
    name: first.name,
    currency: first.currency,
    color: '#4f6bd9',
  });
  ids.set(first.key, h.workspace.id);
  for (const spec of rest) {
    const created = await h.api.workspace.create({
      name: spec.name,
      currency: spec.currency,
      color: '#4f6bd9',
    });
    ids.set(spec.key, created.id);
  }

  const id = (key: string): string => {
    const found = ids.get(key);
    if (found === undefined) throw new Error(`Nothing seeded under ${key}`);
    return found;
  };

  for (const spec of seed.clients ?? []) {
    const created = await h.api.client.create({
      workspaceId: id(spec.workspaceKey),
      name: spec.name,
    });
    ids.set(spec.key, created.id);
  }
  for (const spec of seed.projects ?? []) {
    const created = await h.api.project.create({
      ...projectInput,
      workspaceId: id(spec.workspaceKey),
      name: spec.name,
      rate: spec.rate ?? null,
      clientId: spec.clientKey === undefined ? null : id(spec.clientKey),
    });
    ids.set(spec.key, created.id);
  }

  const watch = <Group extends 'workspace' | 'client' | 'project'>(
    group: Group,
    ...members: Array<keyof (typeof window.timeStop)[Group]>
  ) =>
    Object.fromEntries(
      members.map((member) => [member, vi.spyOn(window.timeStop[group], member as never)]),
    ) as never;

  return {
    workspace: watch('workspace', 'create', 'update', 'delete'),
    client: watch('client', 'create', 'update', 'delete'),
    project: watch('project', 'create', 'update', 'archive', 'unarchive', 'delete'),
    id,
  };
}

function renderTab(props: React.ComponentProps<typeof WorkspacesTab> = {}) {
  renderWith(<WorkspacesTab {...props} />);
}

const slot = (name: string): HTMLElement => {
  const node = document.querySelector<HTMLElement>(`[data-slot="${name}"]`);
  if (!node) throw new Error(`No [data-slot="${name}"]`);
  return node;
};

const group = async (name: string) =>
  within(await screen.findByRole('region', { name }, { timeout: 2000 }));

/** Switches a Workspace section to one of its tabs and scopes queries to that panel. */
async function openTab(groupName: string, tab: string) {
  const section = await group(groupName);
  fireEvent.mouseDown(section.getByRole('tab', { name: tab }), { button: 0, ctrlKey: false });
  return within(await section.findByRole('tabpanel'));
}

/** The in-place input of a Workspace's Name, in its heading. */
async function workspaceName(groupName: string) {
  return (await group(groupName)).getByLabelText('Workspace Name');
}

/** The open editor Popover; the inline Preferences form is not one. */
const editor = () => within(document.querySelector<HTMLElement>('[data-slot="popover-content"]')!);

const editorOpen = () => document.querySelector('[data-slot="popover-content"]') !== null;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('WorkspacesTab groups', () => {
  it('lists the Clients and Projects of every Workspace, whatever the Context', async () => {
    await given({
      workspaces: [workspace('w1', 'Work'), workspace('w2', 'Side')],
      clients: [client('c1', 'w1', 'Acme'), client('c2', 'w2', 'Globex')],
      projects: [
        project({ id: 'p1', workspaceId: 'w1', name: 'Site' }),
        project({ id: 'p2', workspaceId: 'w2', name: 'App' }),
      ],
    });
    renderTab();

    expect(await (await openTab('Work', 'Clients')).findByDisplayValue('Acme')).toBeTruthy();
    expect((await openTab('Work', 'Projects')).getByText('Site')).toBeTruthy();
    expect(await (await openTab('Side', 'Clients')).findByDisplayValue('Globex')).toBeTruthy();
    const sideProjects = await openTab('Side', 'Projects');
    expect(sideProjects.getByText('App')).toBeTruthy();
    expect(sideProjects.queryByText('Site')).toBeNull();
  });

  it('opens every Workspace on its Preferences tab', async () => {
    await given({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    const work = await group('Work');
    expect(work.getByRole('tab', { name: 'Preferences' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    const preferences = within(work.getByRole('tabpanel'));
    expect(preferences.getByRole('button', { name: 'Billable' })).toBeTruthy();
    expect(preferences.getByRole('button', { name: 'Delete' })).toBeTruthy();
    // The Name is edited in the heading, not repeated as a field.
    expect(preferences.queryByLabelText('Name')).toBeNull();
  });

  it('opens no editor from the Workspace heading', async () => {
    await given({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    fireEvent.click(await workspaceName('Work'));
    expect(editorOpen()).toBe(false);
  });

  it("holds one Import button in the page footer, on the Context's Workspace", async () => {
    await given({ workspaces: [workspace('w1', 'Work'), workspace('w2', 'Side')] });
    renderTab();

    await group('Side');
    // By slot and text: a role query by name walks the whole tab on every retry, which is slow
    // enough on CI to outrun the test.
    const buttons = [...document.querySelectorAll('button')].filter(
      (button) => button.textContent === 'Import',
    );
    expect(buttons).toHaveLength(1);
    expect(slot('workspaces-footer').contains(buttons[0]!)).toBe(true);
    fireEvent.click(buttons[0]!);

    const popover = await waitFor(() => slot('import-popover'));
    expect(within(popover).getByLabelText('Workspace').textContent).toBe('Work');
  });

  it('scrolls the focused Workspace into view', async () => {
    const api = await given({ workspaces: [workspace('w1', 'Work'), workspace('w2', 'Side')] });
    renderTab({ focus: api.id('w2') });

    await group('Side');
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1));
    const scrolled = vi.mocked(Element.prototype.scrollIntoView).mock.contexts[0] as Element;
    expect(scrolled.getAttribute('data-workspace-id')).toBe(api.id('w2'));
  });

  it('stays at the top without a focused Workspace', async () => {
    await given({ workspaces: [workspace('w1', 'Work'), workspace('w2', 'Side')] });
    renderTab();

    await group('Side');
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('offers to create the first Client of an empty Workspace', async () => {
    await given({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    const clients = await openTab('Work', 'Clients');
    expect(await clients.findByText('Work has no Clients.')).toBeTruthy();
    expect(clients.queryByRole('button', { name: 'New Client' })).toBeNull();
    fireEvent.click(clients.getByRole('button', { name: 'Create New Client' }));

    // The row is the editor: no Popover opens.
    const name = await clients.findByLabelText('Client Name');
    expect(document.activeElement).toBe(name);
    expect(editorOpen()).toBe(false);
  });
});

describe('WorkspacesTab Projects', () => {
  it('marks a Project with a Rate Billable when its Workspace has a Currency', async () => {
    await given({
      workspaces: [workspace('w1', 'Work', 'USD')],
      projects: [project({ id: 'p1', workspaceId: 'w1', name: 'Site', rate: 80 })],
    });
    renderTab();

    const projects = await openTab('Work', 'Projects');
    expect(await projects.findByText('80/h')).toBeTruthy();
    expect(projects.getByRole('img', { name: 'Billable' })).toBeTruthy();
    expect(projects.queryByText(/Set a Currency/)).toBeNull();
  });

  it('keeps a Project with a Rate not Billable when its Workspace has no Currency', async () => {
    await given({
      workspaces: [workspace('w1', 'Work')],
      projects: [project({ id: 'p1', workspaceId: 'w1', name: 'Site', rate: 80 })],
    });
    renderTab();

    const projects = await openTab('Work', 'Projects');
    expect(await projects.findByText('80/h')).toBeTruthy();
    expect(projects.queryByRole('img', { name: 'Billable' })).toBeNull();
    expect(projects.getByText('Set a Currency on Work to bill')).toBeTruthy();
  });
});

describe('WorkspacesTab create', () => {
  it('creates a Client from its row on Name blur', async () => {
    const api = await given({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    const clients = await openTab('Work', 'Clients');
    fireEvent.click(clients.getByRole('button', { name: 'Create New Client' }));
    const name = await clients.findByLabelText('Client Name');
    fireEvent.change(name, { target: { value: 'Acme' } });
    fireEvent.blur(name);

    await waitFor(() =>
      expect(api.client.create).toHaveBeenCalledWith({ workspaceId: api.id('w1'), name: 'Acme' }),
    );
    expect(await clients.findByDisplayValue('Acme')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('creates no Client when the new row is left empty', async () => {
    const api = await given({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    const clients = await openTab('Work', 'Clients');
    fireEvent.click(clients.getByRole('button', { name: 'Create New Client' }));
    fireEvent.blur(await clients.findByLabelText('Client Name'));

    await waitFor(() => expect(clients.queryByLabelText('Client Name')).toBeNull());
    expect(api.client.create).not.toHaveBeenCalled();
  });

  it('renames a Client in its row', async () => {
    const api = await given({
      workspaces: [workspace('w1', 'Work')],
      clients: [client('c1', 'w1', 'Acme')],
    });
    renderTab();

    const clients = await openTab('Work', 'Clients');
    const name = await clients.findByDisplayValue('Acme');
    fireEvent.change(name, { target: { value: 'Globex' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    fireEvent.blur(name);

    await waitFor(() =>
      expect(api.client.update).toHaveBeenCalledWith({ id: api.id('c1'), name: 'Globex' }),
    );
    expect(await clients.findByDisplayValue('Globex')).toBeTruthy();
  });

  it('creates nothing when the editor closes with an empty Name', async () => {
    const api = await given({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    const projects = await openTab('Work', 'Projects');
    fireEvent.click(projects.getByRole('button', { name: 'Create New Project' }));
    const name = await waitFor(() => editor().getByLabelText('Name'));
    fireEvent.blur(name);
    fireEvent.keyDown(name, { key: 'Escape' });

    await waitFor(() => expect(editorOpen()).toBe(false));
    expect(api.project.create).not.toHaveBeenCalled();
  });

  it('enables the other Project fields once the Name has created the Project', async () => {
    const api = await given({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    const projects = await openTab('Work', 'Projects');
    fireEvent.click(projects.getByRole('button', { name: 'Create New Project' }));
    const name = await waitFor(() => editor().getByLabelText('Name'));
    expect(screen.getByLabelText('Client').hasAttribute('disabled')).toBe(true);
    fireEvent.change(name, { target: { value: 'Site' } });
    fireEvent.keyDown(name, { key: 'Enter' });

    await waitFor(() =>
      expect(api.project.create).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: api.id('w1'), name: 'Site', clientId: null }),
      ),
    );
    expect(PALETTE).toContain(api.project.create.mock.calls[0]![0].color);
    await waitFor(() =>
      expect(screen.getByLabelText('Client').hasAttribute('disabled')).toBe(false),
    );
  });
});

const uuid = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;

/** Radix listens for outside pointer downs from the next tick after opening on. */
async function clickOutside(target: Element) {
  await act(() => new Promise((resolve) => setTimeout(resolve)));
  fireEvent.pointerDown(target);
  fireEvent.click(target);
}

const backdrop = () => document.querySelector('[data-slot="popover-overlay"]')!;

async function openRow(groupName: string, tabName: string, rowName: string) {
  const panel = await openTab(groupName, tabName);
  fireEvent.click(await panel.findByText(rowName));
  return waitFor(() => editor().getByLabelText('Name'));
}

describe('WorkspacesTab auto-apply', () => {
  it('saves a Workspace Name changed in the heading, once', async () => {
    const api = await given({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    const name = await workspaceName('Work');
    fireEvent.change(name, { target: { value: 'Office' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    fireEvent.blur(name);

    await waitFor(() =>
      expect(api.workspace.update).toHaveBeenCalledWith({
        id: api.id('w1'),
        name: 'Office',
        currency: null,
        color: '#4f6bd9',
      }),
    );
    expect(api.workspace.update).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('region', { name: 'Office' })).toBeTruthy();
  });

  it('leaves an unchanged Workspace Name alone', async () => {
    const api = await given({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    fireEvent.blur(await workspaceName('Work'));

    await waitFor(() => expect(screen.getByRole('region', { name: 'Work' })).toBeTruthy());
    expect(api.workspace.update).not.toHaveBeenCalled();
  });

  it('commits the Client as soon as it is picked', async () => {
    const api = await given({
      workspaces: [workspace('w1', 'Work')],
      clients: [client(uuid(90), 'w1', 'Acme')],
      projects: [project({ id: uuid(91), workspaceId: 'w1', name: 'Site' })],
    });
    renderTab();

    await openRow('Work', 'Projects', 'Site');
    await pickOption('Client', 'Acme');

    await waitFor(() =>
      expect(api.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: api.id(uuid(91)), clientId: api.id(uuid(90)), name: 'Site' }),
      ),
    );
  });

  it('keeps the Workspace Name it had when the heading is emptied', async () => {
    const api = await given({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    const name = await workspaceName('Work');
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.blur(name);

    expect(await screen.findByRole('region', { name: 'Work' })).toBeTruthy();
    expect(api.workspace.update).not.toHaveBeenCalled();
  });

  it('keeps an invalid row value unsaved and reverts it when the editor closes', async () => {
    const api = await given({
      workspaces: [workspace('w1', 'Work')],
      projects: [project({ id: uuid(91), workspaceId: 'w1', name: 'Site' })],
    });
    renderTab();

    const name = await openRow('Work', 'Projects', 'Site');
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.blur(name);

    expect(name.getAttribute('aria-invalid')).toBe('true');
    await clickOutside(backdrop());
    await waitFor(() => expect(editorOpen()).toBe(false));
    expect(api.project.update).not.toHaveBeenCalled();

    expect(((await openRow('Work', 'Projects', 'Site')) as HTMLInputElement).value).toBe('Site');
  });

  it('reverts the focused field on the first Escape and closes on the second', async () => {
    const api = await given({
      workspaces: [workspace('w1', 'Work')],
      projects: [project({ id: uuid(91), workspaceId: 'w1', name: 'Site' })],
    });
    renderTab();

    const name = (await openRow('Work', 'Projects', 'Site')) as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Shop' } });
    fireEvent.keyDown(name, { key: 'Escape' });

    expect(name.value).toBe('Site');
    expect(editor().getByLabelText('Name')).toBe(name);
    fireEvent.keyDown(name, { key: 'Escape' });
    await waitFor(() => expect(editorOpen()).toBe(false));
    expect(api.project.update).not.toHaveBeenCalled();
  });

  it('commits the Limits as a unit when their Aspect closes', async () => {
    const api = await given({
      workspaces: [workspace('w1', 'Work')],
      projects: [project({ id: uuid(91), workspaceId: 'w1', name: 'Site' })],
    });
    renderTab();

    const name = await openRow('Work', 'Projects', 'Site');
    fireEvent.click(screen.getByRole('button', { name: 'Limits' }));
    fireEvent.change(await screen.findByLabelText('Min hours'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Max hours'), { target: { value: '5' } });
    expect(api.project.update).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByLabelText('Max hours'), { key: 'Escape' });
    fireEvent.change(screen.getByLabelText('Max hours'), { target: { value: '20' } });
    fireEvent.blur(screen.getByLabelText('Max hours'));
    expect(api.project.update).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByLabelText('Min hours'), { key: 'Enter' });
    expect(api.project.update).not.toHaveBeenCalled();

    await clickOutside(name);
    await waitFor(() =>
      expect(api.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ limitMin: 10, limitMax: 20, limitPeriod: 'week' }),
      ),
    );
    expect(api.project.update).toHaveBeenCalledTimes(1);
  });

  it('saves nothing when the Limits break a cross-field rule', async () => {
    const api = await given({
      workspaces: [workspace('w1', 'Work')],
      projects: [project({ id: uuid(91), workspaceId: 'w1', name: 'Site' })],
    });
    renderTab();

    const name = await openRow('Work', 'Projects', 'Site');
    fireEvent.click(screen.getByRole('button', { name: 'Limits' }));
    fireEvent.change(await screen.findByLabelText('Min hours'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Max hours'), { target: { value: '5' } });
    await clickOutside(name);

    await waitFor(() => expect(screen.queryByLabelText('Min hours')).toBeNull());
    expect(screen.getByRole('button', { name: /10–5 h/ }).getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(api.project.update).not.toHaveBeenCalled();
  });
});

describe('WorkspacesTab colors', () => {
  it('gives a new Workspace a palette color the editor shows', async () => {
    const api = await given({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: 'New Workspace' }));
    const picked = (await screen.findByLabelText('Workspace Color')) as HTMLInputElement;
    expect(PALETTE).toContain(picked.value);

    const name = editor().getByLabelText('Name');
    fireEvent.change(name, { target: { value: 'Side' } });
    fireEvent.keyDown(name, { key: 'Enter' });

    await waitFor(() =>
      expect(api.workspace.create).toHaveBeenCalledWith({
        name: 'Side',
        currency: null,
        color: picked.value,
      }),
    );
  });

  it('saves the color the heading picker settles on', async () => {
    const api = await given({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    const group = await screen.findByRole('region', { name: 'Work' });
    const picker = within(group).getByLabelText('Workspace Color') as HTMLInputElement;
    fireEvent.input(picker, { target: { value: '#112233' } });
    expect(api.workspace.update).not.toHaveBeenCalled();

    picker.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() =>
      expect(api.workspace.update).toHaveBeenCalledWith({
        id: api.id('w1'),
        name: 'Work',
        currency: null,
        color: '#112233',
      }),
    );
  });
});

describe('WorkspacesTab auto-apply details', () => {
  it('commits the color when its picker closes, not while it changes', async () => {
    const api = await given({
      workspaces: [workspace('w1', 'Work')],
      projects: [project({ id: uuid(91), workspaceId: 'w1', name: 'Site' })],
    });
    renderTab();

    await openRow('Work', 'Projects', 'Site');
    const color = screen.getByLabelText('Color') as HTMLInputElement;
    fireEvent.input(color, { target: { value: '#112233' } });
    fireEvent.input(color, { target: { value: '#445566' } });
    expect(api.project.update).not.toHaveBeenCalled();

    color.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() =>
      expect(api.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ color: '#445566' }),
      ),
    );
    expect(api.project.update).toHaveBeenCalledTimes(1);
  });

  it('saves no Currency over 20 characters', async () => {
    const api = await given({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    fireEvent.click((await group('Work')).getByRole('button', { name: 'Billable' }));
    const currency = await screen.findByLabelText('Currency');
    fireEvent.change(currency, { target: { value: 'X'.repeat(21) } });
    fireEvent.keyDown(currency, { key: 'Enter' });

    await waitFor(() => expect(currency.getAttribute('aria-invalid')).toBe('true'));
    expect(api.workspace.update).not.toHaveBeenCalled();
  });

  it('shows a failed save on the field', async () => {
    const api = await given({ workspaces: [workspace('w1', 'Work')] });
    api.workspace.update.mockRejectedValueOnce(new Error('Server unreachable'));
    renderTab();

    fireEvent.click((await group('Work')).getByRole('button', { name: 'Billable' }));
    const currency = await screen.findByLabelText('Currency');
    fireEvent.change(currency, { target: { value: 'EUR' } });
    fireEvent.keyDown(currency, { key: 'Enter' });

    expect(await screen.findByText('Server unreachable')).toBeTruthy();
    expect(currency.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('WorkspacesTab Project move', () => {
  const seed = () =>
    given({
      workspaces: [workspace('w1', 'Work'), workspace('w2', 'Side')],
      clients: [client(uuid(90), 'w1', 'Acme')],
      projects: [project({ id: uuid(91), workspaceId: 'w1', name: 'Site', clientId: uuid(90) })],
    });

  it('moves the Project, without its Client, once confirmed', async () => {
    const api = await seed();
    renderTab();

    await openRow('Work', 'Projects', 'Site');
    await pickOption('Workspace', 'Side');
    expect(api.project.update).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Its Records move to Side; the Client stays behind.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));

    await waitFor(() =>
      expect(api.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: api.id(uuid(91)),
          workspaceId: api.id('w2'),
          clientId: null,
        }),
      ),
    );
    await waitFor(() => expect(editorOpen()).toBe(false));
    expect(await (await openTab('Side', 'Projects')).findByText('Site')).toBeTruthy();
  });

  it('stays in its Workspace when the move is cancelled', async () => {
    const api = await seed();
    renderTab();

    await openRow('Work', 'Projects', 'Site');
    await pickOption('Workspace', 'Side');
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText(/Its Records move to Side/)).toBeNull());
    expect(screen.getByLabelText('Workspace').textContent).toBe('Work');
    expect(api.project.update).not.toHaveBeenCalled();
  });
});
