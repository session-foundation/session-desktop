import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';

import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { UserUtils } from '../../../session/utils';
import { Flex } from '../../basic/Flex';
import { SpacerLG, SpacerMD, SpacerSM } from '../../basic/Text';
import { HelpDeskButton } from '../../buttons';
import { CopyToClipboardButton } from '../../buttons/CopyToClipboardButton';
import { SessionIcon } from '../../icon';
import { SessionInput } from '../../inputs';
import { StyledLeftPaneOverlay } from './OverlayMessage';
import { SessionButtonColor } from '../../basic/SessionButton';
import { localize } from '../../../localization/localeTools';
import { sectionActions } from '../../../state/ducks/section';

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
            <SessionInput
              type="text"
              value={ourSessionID}
              editable={false}
              centerText={true}
              isTextArea={false}
              padding={'var(--margins-xl) var(--margins-sm)'}
              ariaLabel={localize('accountId').toString()}
              inputDataTestId="your-account-id"
            />
          </Flex>
          <SpacerMD />
          <StyledDescription>{window.i18n('accountIdCopyDescription')}</StyledDescription>
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
          <SessionIcon
            iconType={'checkCircle'}
            iconSize={'huge2'}
            iconColor={'var(--primary-color)'}
          />
          <SpacerMD />
          <StyledHeadingContainer $container={true} $justifyContent="center" $alignItems="center">
            <StyledHeading>{window.i18n('accountIdCopied')}</StyledHeading>
            <HelpDeskButton
              iconColor={'var(--text-primary-color)'}
              style={{ display: 'inline-flex' }}
            />
          </StyledHeadingContainer>
          <SpacerSM />
          <StyledDescription>{window.i18n('shareAccountIdDescriptionCopied')}</StyledDescription>
        </>
      )}
    </StyledLeftPaneOverlay>
  );
};
