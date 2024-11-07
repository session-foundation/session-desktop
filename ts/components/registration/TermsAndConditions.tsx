import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { updateTermsOfServicePrivacyModal } from '../../state/onboarding/ducks/modals';
import { Localizer } from '../basic/Localizer';

const StyledTermsAndConditions = styled.div`
  text-align: center;
  font-size: 12px;

  b {
    font-weight: bold;
  }

  &:hover {
    cursor: pointer;
  }
`;

export const TermsAndConditions = () => {
  const dispatch = useDispatch();

  return (
    <StyledTermsAndConditions
      onClick={() => dispatch(updateTermsOfServicePrivacyModal({ show: true }))}
      data-testid="open-url"
    >
      <Localizer token="onboardingTosPrivacy" />
    </StyledTermsAndConditions>
  );
};
