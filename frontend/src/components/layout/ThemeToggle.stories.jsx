import { ThemeProvider } from '../../context/ThemeContext';
import ThemeToggle from './ThemeToggle';

export default {
  title: 'Layout/ThemeToggle',
  component: ThemeToggle,
  decorators: [(Story) => <ThemeProvider><Story /></ThemeProvider>],
};

export const Default = {};