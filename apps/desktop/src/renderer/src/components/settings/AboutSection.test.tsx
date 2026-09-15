// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AboutSection } from './AboutSection';

beforeEach(() => {
  Object.assign(window, {
    desktop: { release: { getVersion: async () => '0.2.0' } },
    timeStop: {
      sync: { getServer: async () => ({ url: null, tokenSet: false, databasePath: '/db' }) },
    },
  });
});
afterEach(cleanup);

describe('AboutSection', () => {
  it('credits Streamline for the icons', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AboutSection />
      </QueryClientProvider>,
    );
    const credit = screen.getByRole('link', { name: 'Free icons from Streamline' });
    expect(credit.getAttribute('href')).toBe('https://streamlinehq.com');
    expect(credit.getAttribute('target')).toBe('_blank');
  });
});
