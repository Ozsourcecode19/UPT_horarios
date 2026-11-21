import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '../../../context/ThemeContext';
import MainLayout from '../MainLayout';

expect.extend(toHaveNoViolations);

vi.mock('../../../context/AuthContext', async () => {
  const real = await vi.importActual('../../../context/AuthContext');
  return {
    ...real,
    useAuth: () => ({ user: { username: 'admin', role: 'ADMIN' }, logout: vi.fn(), isAuthenticated: true }),
  };
});

describe('MainLayout — accesibilidad', () => {
  it('no tiene violaciones de axe', async () => {
    const qc = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <MainLayout />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});