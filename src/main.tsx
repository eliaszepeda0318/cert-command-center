import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { missingConfig } from './lib/config';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
const missing = missingConfig();

if (missing.length) {
  // Firebase throws at import time without config, so the app is only loaded when configured.
  root.render(
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-lg border border-zinc-800 bg-zinc-900/60 p-6">
        <h1 className="text-lg font-semibold">Firebase is not configured</h1>
        <p className="mt-2 text-sm text-zinc-400">Copy <code className="text-zinc-200">.env.example</code> to <code className="text-zinc-200">.env</code> and fill in your Firebase web app config, then restart the dev server. Missing:</p>
        <ul className="mt-3 list-disc pl-5 text-sm text-zinc-300">{missing.map((k) => <li key={k}><code>{k}</code></li>)}</ul>
      </div>
    </div>,
  );
} else {
  Promise.all([import('./App'), import('./context/AuthContext')]).then(([{ default: App }, { AuthProvider }]) => {
    root.render(<React.StrictMode><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><App /></AuthProvider></BrowserRouter></React.StrictMode>);
  });
}
