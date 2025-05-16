import { configureStore } from '@reduxjs/toolkit';
import themeReducer from './ducks/theme';

/** NOTE Dont use this store in a component using the inboxStore since it already has the theme reducer and is persisted  */
export const themeStore = configureStore({
  reducer: { theme: themeReducer },
});

export type ThemeStoreState = ReturnType<typeof themeStore.getState>;
export type ThemeStoreDispatch = typeof themeStore.dispatch;
