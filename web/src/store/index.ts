import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import preferences, { storePreferences } from './preferences';

export function createStore() {
  const store = configureStore({ reducer: { preferences } });

  // Only preferences are persisted. Server data belongs to React Query and the session to its context.
  store.subscribe(() => storePreferences(store.getState().preferences));

  return store;
}

export type AppStore = ReturnType<typeof createStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
