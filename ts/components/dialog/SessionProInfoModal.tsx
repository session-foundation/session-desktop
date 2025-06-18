import { isEmpty, isNull, isUndefined } from 'lodash';
import { Dispatch, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { type SessionProInfoState, updateSessionProInfoModal } from '../../state/ducks/modalDialog';
import { SessionWrapperModal2 } from '../SessionWrapperModal2';
import { SessionButton, SessionButtonType } from '../basic/SessionButton';
import { I18nSubText } from '../basic/I18nSubText';
import { Flex } from '../basic/Flex';
import { SpacerSM, SpacerXS } from '../basic/Text';
import { localize } from '../../localization/localeTools';
import { Constants } from '../../session';

export enum SessionProInfoVariant {
  MESSAGE_TOO_LONG_CTA = 0,
  MESSAGE_TOO_LONG = 1,
}

const StyledScrollDescriptionContainer = styled.div`
  max-height: 150px;
  overflow-y: auto;
  text-align: center;
`;

function getTitle(variant: SessionProInfoVariant): string {
  switch (variant) {
    // TODO: implement with pro
    // case SessionProInfoVariant.MESSAGE_TOO_LONG_CTA:
    //   return localize('modalMessageTooLongCTATitle').toString();
    case SessionProInfoVariant.MESSAGE_TOO_LONG:
      return localize('modalMessageTooLongTitle').toString();
    default:
      throw new Error('Invalid Variant');
  }
}

function getDescription(variant: SessionProInfoVariant, charLimit: number): ReactNode {
  switch (variant) {
    // TODO: implement with pro
    // case SessionProInfoVariant.MESSAGE_TOO_LONG_CTA:
    //   return (
    //     <I18nSubText
    //       localizerProps={{
    //         token: 'modalMessageTooLongCTADescription',
    //         asTag: 'span',
    //         args: {
    //           count: Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_PRO,
    //         },
    //       }}
    //       dataTestId="modal-description"
    //     />
    //   );
    case SessionProInfoVariant.MESSAGE_TOO_LONG:
      return (
        <I18nSubText
          localizerProps={{
            token: 'modalMessageTooLongDescription',
            asTag: 'span',
            args: { count: charLimit },
          }}
          dataTestId="modal-description"
        />
      );
    default:
      throw new Error('Invalid Variant');
  }
}

export function SessionProInfoModal(props: SessionProInfoState) {
  const dispatch = useDispatch();

  function onClose() {
    dispatch(updateSessionProInfoModal(null));
  }

  if (!props || isEmpty(props) || isNull(props.variant) || isUndefined(props.variant)) {
    return null;
  }

  // const mockHasPro = getFeatureFlag('useMockUserHasPro');

  // TODO: get pro status from store once available
  // const hasPro = mockHasPro;
  // const charLimit = hasPro
  //   ? Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_PRO
  //   : Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_STANDARD;
  const charLimit = Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT;

  return (
    <SessionWrapperModal2
      title={getTitle(props.variant)}
      onClose={onClose}
      showExitIcon={true}
      showHeader={true}
    >
      <StyledScrollDescriptionContainer>
        {getDescription(props.variant, charLimit)}
      </StyledScrollDescriptionContainer>
      <SpacerSM />

      <Flex
        $container={true}
        width={'100%'}
        $justifyContent="center"
        $alignItems="center"
        $flexGap="var(--margins-md)"
      >
        <SessionButton
          buttonType={SessionButtonType.Simple}
          onClick={onClose}
          dataTestId="modal-button-session-pro-ok"
        >
          {localize('okay')}
        </SessionButton>
      </Flex>
      <SpacerXS />
    </SessionWrapperModal2>
  );
}

export const showSessionProInfoDialog = (
  variant: SessionProInfoVariant,
  dispatch: Dispatch<any>
) => {
  dispatch(
    updateSessionProInfoModal({
      variant,
    })
  );
};
