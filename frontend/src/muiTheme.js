import { createTheme } from '@mui/material/styles';

export const muiTheme = createTheme({
  palette: {
    primary: {
      main: '#0f2537',
      light: '#1a3a52',
      dark: '#061525',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#00677d',
      light: '#008ba3',
      dark: '#004e5f',
      contrastText: '#ffffff',
    },
    error: { main: '#ba1a1a' },
    success: { main: '#059669' },
    background: { default: '#f8f9ff', paper: '#ffffff' },
    text: { primary: '#0b1c30', secondary: '#43474c' },
    divider: '#e2e8f0',
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 24,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 24,
        },
      },
    },
  },
});
