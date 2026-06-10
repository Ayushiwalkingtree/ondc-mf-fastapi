import { createTheme } from '@mui/material/styles';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#070b14',
      paper: '#0e1628',
    },
    primary: {
      main: '#4f8cff',
      light: '#8fb5ff',
      dark: '#2f67d5',
    },
    secondary: {
      main: '#7c3aed',
    },
    success: {
      main: '#22c55e',
    },
    warning: {
      main: '#f59e0b',
    },
    error: {
      main: '#ef4444',
    },
    text: {
      primary: '#e5eefb',
      secondary: '#94a3b8',
    },
    divider: 'rgba(148, 163, 184, 0.18)',
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 800 },
    h4: { fontWeight: 800 },
    h5: { fontWeight: 800 },
    h6: { fontWeight: 800 },
    button: {
      fontWeight: 800,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 44,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        fullWidth: true,
      },
    },
  },
});
