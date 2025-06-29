import styled from 'styled-components';
import { ContinueButton } from './ContinueButton';
import { Hero } from './Hero';
import { OnboardContainer } from './OnboardingContainer';

const OnboardHeading = styled.h3`
  padding: 0;
  margin: 0;
  font-size: var(--font-size-h4);
`;

const OnboardDescription = styled.p`
  padding: 0;
  margin: 0;
  letter-spacing: normal;
`;

export { ContinueButton, Hero, OnboardContainer, OnboardDescription, OnboardHeading };
