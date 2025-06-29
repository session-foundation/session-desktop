import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';

import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { UserUtils } from '../../../session/utils';
import { Flex } from '../../basic/Flex';
import { SpacerLG, SpacerMD, SpacerSM } from '../../basic/Text';
import { HelpDeskButton } from '../../buttons';
import { CopyToClipboardButton } from '../../buttons/CopyToClipboardButton';
import { StyledLeftPaneOverlay } from './OverlayMessage';
import { SessionButtonColor } from '../../basic/SessionButton';
import { sectionActions } from '../../../state/ducks/section';
import { LucideIcon } from '../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { SessionIDNonEditable } from '../../basic/YourSessionIDPill';
import { localize } from '../../../localization/localeTools';

const StyledHeadingContainer = styled(Flex)`
  .session-icon-button {
    border: 1px solid var(--text-primary-color);
    border-radius: 9999px;
    margin-inline-start: var(--margins-sm);
    transition-duration: var(--default-duration);
  }
`;

const StyledHeading = styled.h3`
  color: var(--text-primary-color);
  font-family: var(--font-default);
  font-size: var(--font-size-sm);
  font-weight: 300;
  margin: 0 auto;
  padding: 0;
`;

const StyledDescription = styled.div`
  color: var(--text-secondary-color);
  font-family: var(--font-default);
  font-style: normal;
  font-weight: 300;
  font-size: 12px;
  line-height: 15px;
  text-align: center;
  margin: 0 auto;
  text-align: center;
  padding: 0 var(--margins-sm);
`;

const StyledButtonerContainer = styled.div`
  .session-button {
    width: 160px;
    height: 41px;
  }
`;

export const OverlayInvite = () => {
  const ourSessionID = UserUtils.getOurPubKeyStrFromCache();

  const [idCopied, setIdCopied] = useState(false);

  const dispatch = useDispatch();

  function closeOverlay() {
    dispatch(sectionActions.resetLeftOverlayMode());
  }

  useKey('Escape', closeOverlay);

  return (
    <StyledLeftPaneOverlay
      $container={true}
      $flexDirection={'column'}
      $flexGrow={1}
      $alignItems={'center'}
      padding={'var(--margins-md)'}
    >
      {!idCopied ? (
        <>
          <Flex $container={true} width={'100%'} $justifyContent="center" $alignItems="center">
            <SessionIDNonEditable dataTestId="your-account-id" sessionId={ourSessionID} />
          </Flex>
          <SpacerMD />
          <StyledDescription>{localize('accountIdCopyDescription').toString()}</StyledDescription>
          <SpacerLG />
          <StyledButtonerContainer>
            <CopyToClipboardButton
              buttonColor={SessionButtonColor.PrimaryDark}
              copyContent={ourSessionID}
              onCopyComplete={() => setIdCopied(true)}
              hotkey={true}
              dataTestId="copy-button-account-id"
            />
          </StyledButtonerContainer>
        </>
      ) : (
        <>
          <LucideIcon
            unicode={LUCIDE_ICONS_UNICODE.CIRCLE_CHECK}
            iconSize={'huge2'}
            iconColor={'var(--primary-color)'}
          />
          <SpacerMD />
          <StyledHeadingContainer $container={true} $justifyContent="center" $alignItems="center">
            <StyledHeading>{localize('accountIdCopied').toString()}</StyledHeading>
            <HelpDeskButton
              style={{ display: 'inline-flex' }}
              iconSize="small"
              iconColor="var(--text-primary-color)"
            />
          </StyledHeadingContainer>
          <SpacerSM />
          <StyledDescription>
            {localize('shareAccountIdDescriptionCopied').toString()}
          </StyledDescription>
        </>
      )}
    </StyledLeftPaneOverlay>
  );
};
