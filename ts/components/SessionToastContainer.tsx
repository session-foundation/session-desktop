import { Slide, ToastContainer, ToastContainerProps } from 'react-toastify';
import styled from 'styled-components';
import { isTestIntegration } from '../shared/env_vars';

// NOTE: https://styled-components.com/docs/faqs#how-can-i-override-styles-with-higher-specificity
const StyledToastContainer = styled(ToastContainer)`
  &&&.Toastify__toast-container {
  }
  .Toastify__toast {
    background: var(--toast-background-color);
    color: var(--text-primary-color);
    border-left: 4px solid var(--primary-color);
  }
  .Toastify__toast--error {
  }
  .Toastify__toast--warning {
  }
  .Toastify__toast--success {
  }
  .Toastify__toast-body {
    line-height: 1.4;
  }
  .Toastify__progress-bar {
    background-color: rgba(0, 0, 0, 0.1);
  }
  .Toastify__close-button {
    color: var(--text-primary-color);
  }
`;

const WrappedToastContainer = ({
  className,
  ...rest
}: ToastContainerProps & { className?: string }) => (
  <div className={className}>
    <StyledToastContainer {...rest} />
  </div>
);

export const SessionToastContainer = () => {
  return (
    <WrappedToastContainer
      position="bottom-right"
      autoClose={isTestIntegration() ? 1000 : 5000}
      hideProgressBar={true}
      newestOnTop={true}
      closeOnClick={true}
      rtl={false}
      pauseOnFocusLoss={false}
      draggable={false}
      pauseOnHover={true}
      transition={Slide}
      limit={5}
      icon={false}
    />
  );
};
