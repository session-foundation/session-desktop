import { useDispatch } from 'react-redux';
import type { AppDispatch } from './createStore';

export function getAppDispatch() {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const dispatch = useDispatch<AppDispatch>();
  return dispatch;
}
