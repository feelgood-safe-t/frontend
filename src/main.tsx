import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import RootFlow from './RootFlow.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootFlow />
  </StrictMode>,
);
