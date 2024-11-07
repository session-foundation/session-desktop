import { isTestIntegration } from '../../shared/env_vars';

export function getMenuAnimation() {
  return isTestIntegration() ? false : ('fade' as const);
}
