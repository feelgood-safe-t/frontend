import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter} from 'react-router';
import RootFlow from './RootFlow.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <RootFlow />
    </HashRouter>
  </StrictMode>,
);
