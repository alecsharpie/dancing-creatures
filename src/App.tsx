import { useState, useEffect } from 'react';
import PoseEstimation from './components/PoseEstimation'
import './App.css'

function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    // Override console methods to capture logs
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    console.log = (...args) => {
      originalConsoleLog(...args);
      setLogs(prev => [...prev, args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ')].slice(-100)); // Keep only last 100 logs
    };

    console.warn = (...args) => {
      originalConsoleWarn(...args);
      setLogs(prev => [...prev, `⚠️ ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ')}`].slice(-100));
    };

    console.error = (...args) => {
      originalConsoleError(...args);
      setLogs(prev => [...prev, `🔴 ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ')}`].slice(-100));
    };

    return () => {
      // Restore original console methods
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
    };
  }, []);

  return (
    <div className="App">
      <PoseEstimation />
      
      <div style={{ position: 'fixed', bottom: '10px', right: '10px', zIndex: 1000 }}>
        <button 
          onClick={() => setShowLogs(!showLogs)}
          style={{ 
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {showLogs ? 'Hide Logs' : 'Show Logs'}
        </button>
      </div>
      
      {showLogs && (
        <div 
          style={{ 
            position: 'fixed', 
            bottom: '50px', 
            right: '10px', 
            width: '80%', 
            maxWidth: '600px',
            height: '300px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '10px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px',
            zIndex: 1000,
            borderRadius: '4px'
          }}
        >
          {logs.map((log, i) => (
            <div key={i} style={{ marginBottom: '4px', wordBreak: 'break-word' }}>{log}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export default App