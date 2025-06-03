import { StyledSessionSpinner, type StyledSessionSpinnerProps } from './StyledSessionSpinner';

export const SessionSpinner = (props: StyledSessionSpinnerProps) => {
  const { loading, height, width, color } = props;

  return loading ? (
    <StyledSessionSpinner
      loading={loading}
      height={height}
      width={width}
      color={color}
      data-testid="loading-spinner"
    >
      <div />
      <div />
      <div />
      <div />
    </StyledSessionSpinner>
  ) : null;
};
