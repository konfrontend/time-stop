// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, Project, Workspace } from '@time-stop/domain';
import { TooltipProvider } from '@/components/ui/tooltip';
import { pickOption } from '@/test/pickOption';
import { WorkspacesTab } from './WorkspacesTab';

const stamp = '2026-09-01T08:00:00.000Z';

function workspace(id: string, name: string, currency: string | null = null): Workspace {
  return { id, name, currency, createdAt: stamp, updatedAt: stamp } as unknown as Workspace;
}

function project(fields: Partial<Project> & Pick<Project, 'id' | 'workspaceId' | 'name'>): Project {
  return {
    clientId: null,
    color: '#3366ff',
    rate: null,
    limitMin: null,
    limitMax: null,
    limitPeriod: null,
    startDate: null,
    endDate: null,
    archived: false,
    createdAt: stamp,
    updatedAt: stamp,
    ...fields,
  } as unknown as Project;
}

function client(id: string, workspaceId: string, name: string): Client {
  return { id, workspaceId, name, createdAt: stamp, updatedAt: stamp } as unknown as Client;
}

/** An in-memory API: creates and updates change what the lists return. */
function fakeApi(seed: { workspaces: Workspace[]; clients?: Client[]; projects?: Project[] }) {
  const db = {
    workspaces: [...seed.workspaces],
    clients: [...(seed.clients ?? [])],
    projects: [...(seed.projects ?? [])],
  };
  let next = 0;
  const id = () => `00000000-0000-7000-8000-${String(++next).padStart(12, '0')}`;
  const replace = <T extends { id: string }>(list: T[], item: T) =>
    list.splice(
      list.findIndex((x) => x.id === item.id),
      1,
      item,
    );
  const api = {
    context: {
      get: async () => ({ workspaceId: db.workspaces[0]!.id, projectId: null }),
      onContextChanged: () => () => {},
    },
    workspace: {
      list: async () => [...db.workspaces],
      create: vi.fn(async (input: { name: string; currency: string | null }) => {
        const created = { ...workspace(id(), input.name), ...input };
        db.workspaces.push(created);
        return created;
      }),
      update: vi.fn(async (input: Workspace) => {
        const current = db.workspaces.find((w) => w.id === input.id)!;
        const updated = { ...current, ...input };
        replace(db.workspaces, updated);
        return updated;
      }),
      delete: vi.fn(),
    },
    client: {
      list: async (input?: { workspaceId?: string }) =>
        db.clients.filter((c) => !input?.workspaceId || c.workspaceId === input.workspaceId),
      create: vi.fn(async (input: { workspaceId: string; name: string }) => {
        const created = client(id(), input.workspaceId, input.name);
        db.clients.push(created);
        return created;
      }),
      update: vi.fn(async (input: { id: string; name: string }) => {
        const updated = { ...db.clients.find((c) => c.id === input.id)!, ...input };
        replace(db.clients, updated);
        return updated;
      }),
      delete: vi.fn(),
    },
    project: {
      list: async (input?: { workspaceId?: string }) =>
        db.projects.filter((p) => !input?.workspaceId || p.workspaceId === input.workspaceId),
      create: vi.fn(async (input: Omit<Project, 'id'>) => {
        const created = project({ ...input, id: id() });
        db.projects.push(created);
        return created;
      }),
      update: vi.fn(async (input: Project) => {
        const updated = { ...db.projects.find((p) => p.id === input.id)!, ...input };
        replace(db.projects, updated);
        return updated;
      }),
      archive: vi.fn(),
      unarchive: vi.fn(),
      delete: vi.fn(),
    },
    record: { count: async () => 0 },
  };
  Object.assign(window, { timeStop: api });
  return api;
}

function renderTab(props: React.ComponentProps<typeof WorkspacesTab> = {}) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <WorkspacesTab {...props} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

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
afterEach(cleanup);

describe('WorkspacesTab groups', () => {
  it('lists the Clients and Projects of every Workspace, whatever the Context', async () => {
    fakeApi({
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
    fakeApi({ workspaces: [workspace('w1', 'Work')] });
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
    fakeApi({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    fireEvent.click(await workspaceName('Work'));
    expect(editorOpen()).toBe(false);
  });

  it("holds one Import button in the page footer, on the Context's Workspace", async () => {
    fakeApi({ workspaces: [workspace('w1', 'Work'), workspace('w2', 'Side')] });
    renderTab();

    await group('Side');
    const buttons = await screen.findAllByRole('button', { name: 'Import' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);

    expect((await screen.findByLabelText('Workspace')).textContent).toBe('Work');
  });

  it('scrolls the focused Workspace into view', async () => {
    fakeApi({ workspaces: [workspace('w1', 'Work'), workspace('w2', 'Side')] });
    renderTab({ focus: 'w2' });

    await group('Side');
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1));
    const scrolled = vi.mocked(Element.prototype.scrollIntoView).mock.contexts[0] as Element;
    expect(scrolled.getAttribute('data-workspace-id')).toBe('w2');
  });

  it('stays at the top without a focused Workspace', async () => {
    fakeApi({ workspaces: [workspace('w1', 'Work'), workspace('w2', 'Side')] });
    renderTab();

    await group('Side');
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('offers to create the first Client of an empty Workspace', async () => {
    fakeApi({ workspaces: [workspace('w1', 'Work')] });
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
    fakeApi({
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
    fakeApi({
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
    const api = fakeApi({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    const clients = await openTab('Work', 'Clients');
    fireEvent.click(clients.getByRole('button', { name: 'Create New Client' }));
    const name = await clients.findByLabelText('Client Name');
    fireEvent.change(name, { target: { value: 'Acme' } });
    fireEvent.blur(name);

    await waitFor(() =>
      expect(api.client.create).toHaveBeenCalledWith({ workspaceId: 'w1', name: 'Acme' }),
    );
    expect(await clients.findByDisplayValue('Acme')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('creates no Client when the new row is left empty', async () => {
    const api = fakeApi({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    const clients = await openTab('Work', 'Clients');
    fireEvent.click(clients.getByRole('button', { name: 'Create New Client' }));
    fireEvent.blur(await clients.findByLabelText('Client Name'));

    await waitFor(() => expect(clients.queryByLabelText('Client Name')).toBeNull());
    expect(api.client.create).not.toHaveBeenCalled();
  });

  it('renames a Client in its row', async () => {
    const api = fakeApi({
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
      expect(api.client.update).toHaveBeenCalledWith({ id: 'c1', name: 'Globex' }),
    );
    expect(await clients.findByDisplayValue('Globex')).toBeTruthy();
  });

  it('creates nothing when the editor closes with an empty Name', async () => {
    const api = fakeApi({ workspaces: [workspace('w1', 'Work')] });
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
    const api = fakeApi({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    const projects = await openTab('Work', 'Projects');
    fireEvent.click(projects.getByRole('button', { name: 'Create New Project' }));
    const name = await waitFor(() => editor().getByLabelText('Name'));
    expect(screen.getByLabelText('Client').hasAttribute('disabled')).toBe(true);
    fireEvent.change(name, { target: { value: 'Site' } });
    fireEvent.keyDown(name, { key: 'Enter' });

    await waitFor(() =>
      expect(api.project.create).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'w1', name: 'Site', clientId: null }),
      ),
    );
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
    const api = fakeApi({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    const name = await workspaceName('Work');
    fireEvent.change(name, { target: { value: 'Office' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    fireEvent.blur(name);

    await waitFor(() =>
      expect(api.workspace.update).toHaveBeenCalledWith({
        id: 'w1',
        name: 'Office',
        currency: null,
      }),
    );
    expect(api.workspace.update).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('region', { name: 'Office' })).toBeTruthy();
  });

  it('leaves an unchanged Workspace Name alone', async () => {
    const api = fakeApi({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    fireEvent.blur(await workspaceName('Work'));

    await waitFor(() => expect(screen.getByRole('region', { name: 'Work' })).toBeTruthy());
    expect(api.workspace.update).not.toHaveBeenCalled();
  });

  it('commits the Client as soon as it is picked', async () => {
    const api = fakeApi({
      workspaces: [workspace('w1', 'Work')],
      clients: [client(uuid(90), 'w1', 'Acme')],
      projects: [project({ id: uuid(91), workspaceId: 'w1', name: 'Site' })],
    });
    renderTab();

    await openRow('Work', 'Projects', 'Site');
    await pickOption('Client', 'Acme');

    await waitFor(() =>
      expect(api.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: uuid(91), clientId: uuid(90), name: 'Site' }),
      ),
    );
  });

  it('keeps the Workspace Name it had when the heading is emptied', async () => {
    const api = fakeApi({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    const name = await workspaceName('Work');
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.blur(name);

    expect(await screen.findByRole('region', { name: 'Work' })).toBeTruthy();
    expect(api.workspace.update).not.toHaveBeenCalled();
  });

  it('keeps an invalid row value unsaved and reverts it when the editor closes', async () => {
    const api = fakeApi({
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
    const api = fakeApi({
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
    const api = fakeApi({
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
    const api = fakeApi({
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

describe('WorkspacesTab auto-apply details', () => {
  it('commits the color when its picker closes, not while it changes', async () => {
    const api = fakeApi({
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
    const api = fakeApi({ workspaces: [workspace('w1', 'Work')] });
    renderTab();

    fireEvent.click((await group('Work')).getByRole('button', { name: 'Billable' }));
    const currency = await screen.findByLabelText('Currency');
    fireEvent.change(currency, { target: { value: 'X'.repeat(21) } });
    fireEvent.keyDown(currency, { key: 'Enter' });

    await waitFor(() => expect(currency.getAttribute('aria-invalid')).toBe('true'));
    expect(api.workspace.update).not.toHaveBeenCalled();
  });

  it('shows a failed save on the field', async () => {
    const api = fakeApi({ workspaces: [workspace('w1', 'Work')] });
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
    fakeApi({
      workspaces: [workspace('w1', 'Work'), workspace('w2', 'Side')],
      clients: [client(uuid(90), 'w1', 'Acme')],
      projects: [project({ id: uuid(91), workspaceId: 'w1', name: 'Site', clientId: uuid(90) })],
    });

  it('moves the Project, without its Client, once confirmed', async () => {
    const api = seed();
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
        expect.objectContaining({ id: uuid(91), workspaceId: 'w2', clientId: null }),
      ),
    );
    await waitFor(() => expect(editorOpen()).toBe(false));
    expect(await (await openTab('Side', 'Projects')).findByText('Site')).toBeTruthy();
  });

  it('stays in its Workspace when the move is cancelled', async () => {
    const api = seed();
    renderTab();

    await openRow('Work', 'Projects', 'Site');
    await pickOption('Workspace', 'Side');
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText(/Its Records move to Side/)).toBeNull());
    expect(screen.getByLabelText('Workspace').textContent).toBe('Work');
    expect(api.project.update).not.toHaveBeenCalled();
  });
});
