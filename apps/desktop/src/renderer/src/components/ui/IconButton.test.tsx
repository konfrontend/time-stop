// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TooltipProvider } from '@/components/ui/tooltip';
import { IconButton } from './IconButton';

afterEach(cleanup);

const withTooltips = (node: React.ReactNode) => render(<TooltipProvider>{node}</TooltipProvider>);

describe('IconButton', () => {
  it('is named by its label and shows it as a Tooltip', async () => {
    const onClick = vi.fn();
    withTooltips(
      <IconButton label="Export" onClick={onClick}>
        <svg />
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Export' });
    fireEvent.focus(button);
    expect((await screen.findByRole('tooltip')).textContent).toBe('Export');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows a Tooltip that says more than its name', async () => {
    withTooltips(
      <IconButton label="Recent Records" tooltip="Show Recent Records">
        <svg />
      </IconButton>,
    );
    fireEvent.focus(screen.getByRole('button', { name: 'Recent Records' }));
    expect((await screen.findByRole('tooltip')).textContent).toBe('Show Recent Records');
  });

  it('opens what it triggers', async () => {
    withTooltips(
      <Popover>
        <PopoverTrigger asChild>
          <IconButton label="New Workspace">
            <svg />
          </IconButton>
        </PopoverTrigger>
        <PopoverContent>Editor</PopoverContent>
      </Popover>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'New Workspace' }));
    expect((await screen.findByRole('dialog')).textContent).toBe('Editor');
  });
});
