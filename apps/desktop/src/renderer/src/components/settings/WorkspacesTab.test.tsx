// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectInput } from '@app/db/testing';
import { PALETTE } from '@/lib/colors';
import type { Harness } from '@/test/harness';
import { harness, renderWith } from '@/test/harness';
import { nameWorkspace } from '@/test/fixtures';
import { pickOption } from '@/test/pickOption';
import { slot } from '@/test/slot';
import { WorkspacesTab } from './WorkspacesTab';

interface Seeded {
  h: Harness;
  work: string;
  side: string;
  client: string;
  project: string;
}

/** Work (the bootstrap Workspace) holding Acme and Site, and an empty Side. */
async function seed(): Promise<Seeded> {
  const h = harness();
  await nameWorkspace(h, { name: 'Work', currency: null });
  const side = await h.api.workspace.create({ name: 'Side', currency: null, color: '#4f6bd9' });
  const client = await h.api.client.create({ workspaceId: h.workspace.id, name: 'Acme' });
  const project = await h.api.project.create({
    ...projectInput,
    workspaceId: h.workspace.id,
    name: 'Site',
    clientId: client.id,
  });
  return { h, work: h.workspace.id, side: side.id, client: client.id, project: project.id };
}

const projectOf = async (h: Harness, id: string) =>
  (await h.api.project.list()).find((project) => project.id === id)!;

const workspaceOf = async (h: Harness, id: string) =>
  (await h.api.workspace.list()).find((workspace) => workspace.id === id)!;

async function group(name: string) {
  return within(
    await waitFor(
      () => {
        const found = [
          ...document.querySelectorAll<HTMLElement>('[data-slot="workspace-group"]'),
        ].find((node) => node.getAttribute('aria-label') === name);
        if (!found) throw new Error(`No Workspace ${name}`);
        return found;
      },
      { timeout: 2000 },
    ),
  );
}

async function openTab(groupName: string, tab: string) {
  const section = await group(groupName);
  fireEvent.mouseDown(section.getByRole('tab', { name: tab }), { button: 0, ctrlKey: false });
  return within(await section.findByRole('tabpanel'));
}

const editor = () => within(document.querySelector<HTMLElement>('[data-slot="popover-content"]')!);

const editorOpen = () => document.querySelector('[data-slot="popover-content"]') !== null;

async function openProject(groupName: string, name: string) {
  const panel = await openTab(groupName, 'Projects');
  fireEvent.click(await panel.findByText(name));
  return waitFor(() => editor().getByLabelText('Name'));
}

/** Radix listens for outside pointer downs from the next tick after opening on. */
async function clickOutside(target: Element) {
  await act(() => new Promise((resolve) => setTimeout(resolve)));
  fireEvent.pointerDown(target);
  fireEvent.click(target);
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('WorkspacesTab groups', () => {
  it('lists the Clients and Projects of each Workspace under that Workspace', async () => {
    const { h, side } = await seed();
    await h.api.project.create({ ...projectInput, workspaceId: side, name: 'App' });
    renderWith(<WorkspacesTab />);

    expect(await (await openTab('Work', 'Clients')).findByDisplayValue('Acme')).toBeTruthy();
    expect((await openTab('Work', 'Projects')).getByText('Site')).toBeTruthy();
    const sideProjects = await openTab('Side', 'Projects');
    expect(sideProjects.getByText('App')).toBeTruthy();
    expect(sideProjects.queryByText('Site')).toBeNull();
  });

  it('scrolls the focused Workspace into view', async () => {
    const { side } = await seed();
    renderWith(<WorkspacesTab focus={side} />);

    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1));
    const scrolled = vi.mocked(Element.prototype.scrollIntoView).mock.contexts[0] as Element;
    expect(scrolled.getAttribute('data-workspace-id')).toBe(side);
  });
});

describe('WorkspacesTab heading', () => {
  it('saves the Workspace Name', async () => {
    const { h, work } = await seed();
    renderWith(<WorkspacesTab />);

    const name = (await group('Work')).getByLabelText('Workspace Name');
    fireEvent.change(name, { target: { value: 'Office' } });
    fireEvent.blur(name);

    await waitFor(async () => expect((await workspaceOf(h, work)).name).toBe('Office'));
  });

  it('keeps the Workspace Name it had when the heading is emptied', async () => {
    const { h, work } = await seed();
    const update = vi.spyOn(window.api.workspace, 'update');
    renderWith(<WorkspacesTab />);

    const name = (await group('Work')).getByLabelText('Workspace Name');
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.blur(name);

    await group('Work');
    expect(update).not.toHaveBeenCalled();
    expect((await workspaceOf(h, work)).name).toBe('Work');
  });

  it('saves the color the picker settles on', async () => {
    const { h, work } = await seed();
    renderWith(<WorkspacesTab />);

    const picker = (await group('Work')).getByLabelText('Workspace Color') as HTMLInputElement;
    fireEvent.input(picker, { target: { value: '#112233' } });
    picker.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(async () => expect((await workspaceOf(h, work)).color).toBe('#112233'));
  });

  it('saves the Currency set under Billable', async () => {
    const { h, work } = await seed();
    renderWith(<WorkspacesTab />);

    fireEvent.click((await group('Work')).getByRole('button', { name: 'Billable' }));
    const currency = await screen.findByLabelText('Currency');
    fireEvent.change(currency, { target: { value: 'EUR' } });
    fireEvent.keyDown(currency, { key: 'Enter' });

    await waitFor(async () => expect((await workspaceOf(h, work)).currency).toBe('EUR'));
  });

  it('creates a Workspace in a palette color', async () => {
    const { h } = await seed();
    renderWith(<WorkspacesTab />);

    fireEvent.click(await screen.findByRole('button', { name: 'New Workspace' }));
    const name = await waitFor(() => editor().getByLabelText('Name'));
    fireEvent.change(name, { target: { value: 'Hobby' } });
    fireEvent.keyDown(name, { key: 'Enter' });

    await waitFor(async () => {
      const created = (await h.api.workspace.list()).find((each) => each.name === 'Hobby');
      expect(PALETTE).toContain(created?.color);
    });
  });
});

describe('WorkspacesTab Clients', () => {
  it('creates a Client from its row', async () => {
    const { h, side } = await seed();
    renderWith(<WorkspacesTab />);

    const clients = await openTab('Side', 'Clients');
    fireEvent.click(clients.getByRole('button', { name: 'Create New Client' }));
    const name = await clients.findByLabelText('Client Name');
    fireEvent.change(name, { target: { value: 'Globex' } });
    fireEvent.blur(name);

    await waitFor(async () =>
      expect(await h.api.client.list()).toContainEqual(
        expect.objectContaining({ workspaceId: side, name: 'Globex' }),
      ),
    );
  });

  it('renames a Client in its row', async () => {
    const { h, client } = await seed();
    renderWith(<WorkspacesTab />);

    const name = await (await openTab('Work', 'Clients')).findByDisplayValue('Acme');
    fireEvent.change(name, { target: { value: 'Globex' } });
    fireEvent.blur(name);

    await waitFor(async () =>
      expect((await h.api.client.list()).find((each) => each.id === client)?.name).toBe('Globex'),
    );
  });
});

describe('WorkspacesTab Projects', () => {
  it('creates a Project from its Name, in a palette color, then opens the other fields', async () => {
    const { h, side } = await seed();
    renderWith(<WorkspacesTab />);

    const projects = await openTab('Side', 'Projects');
    fireEvent.click(projects.getByRole('button', { name: 'Create New Project' }));
    const name = await waitFor(() => editor().getByLabelText('Name'));
    expect(editor().getByLabelText('Client').hasAttribute('disabled')).toBe(true);
    fireEvent.change(name, { target: { value: 'Shop' } });
    fireEvent.keyDown(name, { key: 'Enter' });

    await waitFor(async () => {
      const created = (await h.api.project.list()).find((each) => each.name === 'Shop');
      expect(created).toMatchObject({ workspaceId: side, clientId: null });
      expect(PALETTE).toContain(created?.color);
    });
    await waitFor(() =>
      expect(editor().getByLabelText('Client').hasAttribute('disabled')).toBe(false),
    );
  });

  it('saves the Client as soon as it is picked', async () => {
    const { h, work, project } = await seed();
    const initech = await h.api.client.create({ workspaceId: work, name: 'Initech' });
    renderWith(<WorkspacesTab />);

    await openProject('Work', 'Site');
    await pickOption('Client', 'Initech');

    await waitFor(async () => expect((await projectOf(h, project)).clientId).toBe(initech.id));
  });

  it('saves the color the picker settles on', async () => {
    const { h, project } = await seed();
    renderWith(<WorkspacesTab />);

    await openProject('Work', 'Site');
    const color = editor().getByLabelText('Color') as HTMLInputElement;
    fireEvent.input(color, { target: { value: '#445566' } });
    color.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(async () => expect((await projectOf(h, project)).color).toBe('#445566'));
  });

  it('saves the Limits when their Aspect closes', async () => {
    const { h, project } = await seed();
    renderWith(<WorkspacesTab />);

    const name = await openProject('Work', 'Site');
    fireEvent.click(editor().getByRole('button', { name: 'Limits' }));
    fireEvent.change(await screen.findByLabelText('Min hours'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Max hours'), { target: { value: '20' } });
    await clickOutside(name);

    await waitFor(async () =>
      expect(await projectOf(h, project)).toMatchObject({ limitMin: 10, limitMax: 20 }),
    );
  });

  it('moves the Project to another Workspace once confirmed', async () => {
    const { h, side, project } = await seed();
    renderWith(<WorkspacesTab />);

    await openProject('Work', 'Site');
    await pickOption('Workspace', 'Side');
    const confirm = await slot('move-confirm');
    expect((await projectOf(h, project)).workspaceId).not.toBe(side);
    fireEvent.click(confirm.getByRole('button', { name: 'Move' }));

    await waitFor(async () => expect((await projectOf(h, project)).workspaceId).toBe(side));
    await waitFor(() => expect(editorOpen()).toBe(false));
  });

  it('keeps the Project in its Workspace when the move is cancelled', async () => {
    const { h, work, project } = await seed();
    const update = vi.spyOn(window.api.project, 'update');
    renderWith(<WorkspacesTab />);

    await openProject('Work', 'Site');
    await pickOption('Workspace', 'Side');
    const confirm = await slot('move-confirm');
    fireEvent.click(confirm.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(document.querySelector('[data-slot="move-confirm"]')).toBeNull());
    expect(update).not.toHaveBeenCalled();
    expect((await projectOf(h, project)).workspaceId).toBe(work);
  });
});
