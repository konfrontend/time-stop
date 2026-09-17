// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { harness, renderWith } from '@/test/harness';
import { AboutSection } from './AboutSection';

beforeEach(harness);
afterEach(cleanup);

describe('AboutSection', () => {
  it('credits Streamline for the icons', () => {
    renderWith(<AboutSection />);
    const credit = screen.getByRole('link', { name: 'Free icons from Streamline' });
    expect(credit.getAttribute('href')).toBe('https://streamlinehq.com');
    expect(credit.getAttribute('target')).toBe('_blank');
  });
});
