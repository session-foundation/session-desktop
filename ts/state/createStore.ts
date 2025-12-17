import { configureStore } from '@reduxjs/toolkit';
import promiseMiddleware from 'redux-promise-middleware';
import { rootReducer } from './reducer';

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
