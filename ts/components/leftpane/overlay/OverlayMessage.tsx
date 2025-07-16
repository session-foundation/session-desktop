import { useState } from 'react';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';

import { motion } from 'framer-motion';
import { isEmpty } from 'lodash';
import { useDispatch } from 'react-redux';
import { toASCII } from 'punycode';

import { ConvoHub } from '../../../session/conversations';

import { PubKey } from '../../../session/types';
import { openConversationWithMessages } from '../../../state/ducks/conversations';
import { sectionActions } from '../../../state/ducks/section';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';
import { SessionSpinner } from '../../loading';

import { ONSResolve } from '../../../session/apis/snode_api/onsResolve';
import { NotFoundError, SnodeResponseError } from '../../../session/utils/errors';
import { THEME_GLOBALS } from '../../../themes/globals';
import { Flex } from '../../basic/Flex';
import { SpacerLG, SpacerMD } from '../../basic/Text';
import { HelpDeskButton } from '../../buttons';
import { ConversationTypeEnum } from '../../../models/types';
import { Localizer } from '../../basic/Localizer';
import { SimpleSessionTextarea } from '../../inputs/SessionInput';
import { localize } from '../../../localization/localeTools';

const StyledDescriptionContainer = styled(motion.div)`
  margin: 0 auto;
  text-align: center;
  padding: 0 var(--margins-md);

  .session-icon-button {
    border: 1px solid var(--text-secondary-color);
    border-radius: 9999px;
    margin-inline-start: var(--margins-xs);
    transition-duration: var(--default-duration);

    &:hover {
      border-color: var(--text-primary-color);
    }
  }
`;

const SessionIDDescription = styled.span`
  color: var(--text-secondary-color);
  font-family: var(--font-default);
  font-style: normal;
  font-weight: 400;
  font-size: 12px;
  text-align: center;
`;

export const StyledLeftPaneOverlay = styled(Flex)`
  background: var(--background-primary-color);
  overflow-y: auto;
  overflow-x: hidden;

  .session-button {
    width: 100%;
  }
`;

export const OverlayMessage = () => {
  const dispatch = useDispatch();

  function closeOverlay() {
    dispatch(sectionActions.resetLeftOverlayMode());
  }

  useKey('Escape', closeOverlay);
  const [pubkeyOrOns, setPubkeyOrOns] = useState('');
  const [pubkeyOrOnsError, setPubkeyOrOnsError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const disableNextButton = !pubkeyOrOns || loading;

  async function openConvoOnceResolved(resolvedSessionID: string) {
    const convo = await ConvoHub.use().getOrCreateAndWait(
      resolvedSessionID,
      ConversationTypeEnum.PRIVATE
    );

    // we now want to show a conversation we just started on the left pane, even if we did not send a message to it yet
    if (!convo.isActive() || convo.isHidden()) {
      // bump the timestamp only if we were not active before
      if (!convo.isActive()) {
        convo.set({ active_at: Date.now() });
      }
      await convo.unhideIfNeeded(false);

      await convo.commit();
    }

    await openConversationWithMessages({ conversationKey: resolvedSessionID, messageId: null });

    closeOverlay();
  }

  async function handleMessageButtonClick() {
    setPubkeyOrOnsError(undefined);

    if ((!pubkeyOrOns && !pubkeyOrOns.length) || !pubkeyOrOns.trim().length) {
      setPubkeyOrOnsError(window.i18n('accountIdErrorInvalid'));
      return;
    }

    const pubkeyOrOnsTrimmed = toASCII(pubkeyOrOns.trim());
    const validationError = PubKey.validateWithErrorNoBlinding(pubkeyOrOnsTrimmed);

    if (!validationError) {
      await openConvoOnceResolved(pubkeyOrOnsTrimmed);
      return;
    }

    const isPubkey = PubKey.validate(pubkeyOrOnsTrimmed);
    const isGroupPubkey = PubKey.is03Pubkey(pubkeyOrOnsTrimmed);
    if ((isPubkey && validationError) || isGroupPubkey) {
      setPubkeyOrOnsError(validationError);
      return;
    }

    // this might be an ONS, validate the regex first
    const mightBeOnsName = new RegExp(ONSResolve.onsNameRegex, 'g').test(pubkeyOrOnsTrimmed);
    if (!mightBeOnsName) {
      setPubkeyOrOnsError(window.i18n('onsErrorNotRecognized'));
      return;
    }

    setLoading(true);
    try {
      const resolvedSessionID = await ONSResolve.getSessionIDForOnsName(pubkeyOrOnsTrimmed);
      const idValidationError = PubKey.validateWithErrorNoBlinding(resolvedSessionID);

      if (idValidationError) {
        setPubkeyOrOnsError(window.i18n('onsErrorNotRecognized'));
        return;
      }

      await openConvoOnceResolved(resolvedSessionID);
    } catch (e) {
      setPubkeyOrOnsError(
        e instanceof SnodeResponseError
          ? window.i18n('onsErrorUnableToSearch')
          : e instanceof NotFoundError
            ? window.i18n('onsErrorNotRecognized')
            : window.i18n('onsErrorUnableToSearch')
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <StyledLeftPaneOverlay
      $container={true}
      $flexDirection={'column'}
      $flexGrow={1}
      $alignItems={'center'}
      padding={'var(--margins-md)'}
    >
      <SimpleSessionTextarea
        ariaLabel="New conversation input"
        autoFocus={true}
        placeholder={localize('accountIdOrOnsEnter').toString()}
        value={pubkeyOrOns}
        onValueChanged={setPubkeyOrOns}
        providedError={pubkeyOrOnsError}
        // centerText={true}
        disabled={loading}
        errorDataTestId="error-message"
        inputDataTestId="new-session-conversation"
        singleLine={true}
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onEnterPressed={handleMessageButtonClick}
      />
      <SpacerMD />
      <SessionSpinner loading={loading} />

      {!pubkeyOrOnsError && !loading ? (
        <>
          <StyledDescriptionContainer
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: THEME_GLOBALS['--default-duration-seconds'] }}
          >
            <SessionIDDescription>
              <Localizer token="messageNewDescriptionDesktop" />
            </SessionIDDescription>
            <HelpDeskButton
              iconSize="small"
              style={{ display: 'inline-flex' }}
              iconColor="var(--text-secondary-color)"
            />
          </StyledDescriptionContainer>
          <SpacerLG />
        </>
      ) : null}

      {!isEmpty(pubkeyOrOns) ? (
        <SessionButton
          ariaLabel={window.i18n('next')}
          text={window.i18n('next')}
          disabled={disableNextButton}
          onClick={handleMessageButtonClick}
          buttonColor={SessionButtonColor.PrimaryDark}
          dataTestId="next-new-conversation-button"
        />
      ) : null}
    </StyledLeftPaneOverlay>
  );
};
