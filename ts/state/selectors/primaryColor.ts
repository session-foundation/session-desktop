import { useSelector } from 'react-redux';
import { PrimaryColorStateType } from '../../themes/constants/colors';
import { StateType } from '../reducer';

export const getPrimaryColor = (state: StateType): PrimaryColorStateType => state.primaryColor;

export function usePrimaryColor() {
  return useSelector(getPrimaryColor);
}
