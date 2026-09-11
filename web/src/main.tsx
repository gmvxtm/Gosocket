import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { createQueryClient } from './query-client';
import { createStore } from './store';
import { SessionProvider } from './session/SessionContext';
import './i18n';
import './styles.css';

// Four kinds of state, four tools: server data in React Query, shared preferences in the store,
// the session in its context and everything ephemeral in the components.
const queryClient = createQueryClient();
const store = createStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SessionProvider>
            <App />
          </SessionProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  </StrictMode>
);
