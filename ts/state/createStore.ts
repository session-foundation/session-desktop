/* eslint-disable no-console */
import storage from 'redux-persist/lib/storage';

import { configureStore } from '@reduxjs/toolkit';

import { persistReducer } from 'redux-persist';

import promiseMiddleware from 'redux-promise-middleware';
import { rootReducer } from './reducer';

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['userConfig'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const middlewareList = [promiseMiddleware];

export const createStore = (initialState: any) =>
  configureStore({
    reducer: persistedReducer,
    preloadedState: initialState,
    middleware: (getDefaultMiddleware: any) =>
      getDefaultMiddleware({
        serializableCheck: true,
        immutableCheck: true,
      }).concat(middlewareList),
  });
