import { ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { closeRightPanel } from '../../../../../state/ducks/conversations';
import { Flex } from '../../../../basic/Flex';
import { SessionIconButton } from '../../../../icon';
import { sectionActions } from '../../../../../state/ducks/section';

export const HeaderTitle = styled.h2`
  font-family: var(--font-default);
  font-size: var(--font-size-h2);
  text-align: center;
  margin-top: 0px;
  margin-bottom: 0px;
  word-break: break-word;
`;

export const HeaderSubtitle = styled.h3`
  font-family: var(--font-default);
  font-size: var(--font-size-sm);
  font-weight: 400;
  text-align: center;
  padding-top: 0px;
  margin-top: 0;
`;

type HeaderProps = {
  hideBackButton?: boolean;
  backButtonDirection?: 'left' | 'right';
  backButtonOnClick?: () => void;
  hideCloseButton?: boolean;
  closeButtonOnClick?: () => void;
  children?: ReactNode;
  paddingTop: string;
};

export const Header = (props: HeaderProps) => {
  const {
    children,
    hideBackButton = false,
    backButtonDirection = 'left',
    backButtonOnClick,
    hideCloseButton = false,
    closeButtonOnClick,
    paddingTop,
  } = props;
  const dispatch = useDispatch();

  return (
    <Flex
      $container={true}
      width={'100%'}
      padding={`${paddingTop} var(--margins-lg) var(--margins-md)`}
    >
      {!hideBackButton && (
        <SessionIconButton
          iconSize={'medium'}
          iconType={'chevron'}
          iconRotation={backButtonDirection === 'left' ? 90 : 270}
          onClick={() => {
            if (backButtonOnClick) {
              backButtonOnClick();
            } else {
              dispatch(sectionActions.resetRightOverlayMode());
            }
          }}
          dataTestId="back-button-conversation-options"
        />
      )}
      <Flex
        $container={true}
        $flexDirection={'column'}
        $justifyContent={'flex-start'}
        $alignItems={'center'}
        width={'100%'}
        margin={'-5px auto auto'}
      >
        {children}
      </Flex>
      {!hideCloseButton && (
        <SessionIconButton
          iconSize={'tiny'}
          iconType={'exit'}
          onClick={() => {
            if (closeButtonOnClick) {
              closeButtonOnClick();
            } else {
              dispatch(closeRightPanel());
              dispatch(sectionActions.resetRightOverlayMode());
            }
          }}
        />
      )}
    </Flex>
  );
};
