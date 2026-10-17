import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';


class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: '#ff6972', background: '#090b0e', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2 style={{ color: '#ff6972', marginBottom: 12 }}>Application Error</h2>
          <p style={{ color: '#e7eaf1', marginBottom: 16 }}>An unhandled error occurred while rendering the application:</p>
          <pre style={{ background: '#11151b', padding: 16, borderRadius: 8, border: '1px solid #232832', whiteSpace: 'pre-wrap', color: '#ffb0b4' }}>
            {String(this.state.error?.stack || this.state.error)}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: '10px 20px', background: '#1b2b33', color: '#a3d8e8', border: '1px solid #2a4955', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
