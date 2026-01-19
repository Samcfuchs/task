import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Site from './Site.tsx'
//import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// createRoot(document.getElementById('root')!).render(
//   <StrictMode>
//     {/* <Login /> */}
//     <Site />
//     {/* <Page /> */}
//   </StrictMode>,
// )

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Site />
    </BrowserRouter>
  </StrictMode>
);
