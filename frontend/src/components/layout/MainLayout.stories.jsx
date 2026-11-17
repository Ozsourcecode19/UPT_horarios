import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import MainLayout from './MainLayout';

const mockUser = () => {
  try {
    localStorage.setItem('token', 'demo-token');
    localStorage.setItem('user', JSON.stringify({ username: 'admin', role: 'ADMIN' }));
    localStorage.setItem('sidebar_colapsado', '1');
  } catch { /* noop */ }
};

export default {
  title: 'Layout/MainLayout',
  component: MainLayout,
  decorators: [
    (Story) => {
      mockUser();
      return (
        <ThemeProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <AuthProvider>
              <Story />
            </AuthProvider>
          </MemoryRouter>
        </ThemeProvider>
      );
    },
  ],
  parameters: { layout: 'fullscreen' },
};

export const Colapsado = {};

export const Expandido = {
  decorators: [
    (Story) => {
      try { localStorage.setItem('sidebar_colapsado', '0'); } catch { /* noop */ }
      return <Story />;
    },
  ],
};