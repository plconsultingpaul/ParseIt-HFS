import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

try {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
} catch (error) {
  console.error('Failed to render app:', error);
  rootElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui;">
      <div style="text-align: center;">
        <h1 style="color: #dc2626;">Application Error</h1>
        <p style="color: #374151;">Failed to load the application. Please check the console for details.</p>
        <pre style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; text-align: left; overflow: auto;">${error}</pre>
      </div>
    </div>
  `;
}
