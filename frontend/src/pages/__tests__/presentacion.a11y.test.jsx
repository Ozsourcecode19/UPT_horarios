import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '../../context/ThemeContext';
import { AuthProvider } from '../../context/AuthContext';
import Presentacion from '../Presentacion';

expect.extend(toHaveNoViolations);

describe('Presentacion — accesibilidad', () => {
  it('no tiene violaciones de axe', async () => {
    const { container } = render(
      <ThemeProvider>
        <MemoryRouter>
          <AuthProvider>
            <Presentacion />
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});