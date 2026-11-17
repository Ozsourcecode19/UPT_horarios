import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import Presentacion from './Presentacion';

export default {
  title: 'Pages/Presentacion',
  component: Presentacion,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <MemoryRouter>
          <AuthProvider>
            <Story />
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    ),
  ],
};

export const SinSesion = {};

export const ConSesion = {
  decorators: [
    (Story) => {
      try { localStorage.setItem('token', 'demo'); } catch { /* noop */ }
      return <Story />;
    },
  ],
};