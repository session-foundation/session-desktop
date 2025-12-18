import { configureStore } from '@reduxjs/toolkit';
import promiseMiddleware from 'redux-promise-middleware';
import { setGlobalDevModeChecks } from 'reselect';
import { rootReducer } from './reducer';
import { isDebugMode } from '../shared/env_vars';

// NOTE: debugging tool for redux selectors globally
if (isDebugMode()) {
  setGlobalDevModeChecks({
    inputStabilityCheck: 'always',
    identityFunctionCheck: 'always',
  });
}

const middlewareList = [promiseMiddleware];

export const createStore = (initialState: any) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: initialState,
    middleware: (getDefaultMiddleware: any) =>
      getDefaultMiddleware({
        immutableCheck: true,
      }).concat(middlewareList),
  });

export type AppDispatch = ReturnType<typeof createStore>['dispatch'];
