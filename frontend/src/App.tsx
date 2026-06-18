import Router from './router';
import ErrorBoundary from './components/ErrorBoundary';
import { I18nProvider } from './contexts/I18nContext';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <I18nProvider>
          <Router />
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
