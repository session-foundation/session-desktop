import { ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { closeRightPanel } from '../../../../../state/ducks/conversations';
import { Flex } from '../../../../basic/Flex';
import { sectionActions } from '../../../../../state/ducks/section';
import { SessionLucideIconButton } from '../../../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../../../icon/lucide';

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
  // limit the width of the subtitle to have a nicer look (and not one long line)
  max-width: 50ch;
`;

type HeaderProps = (
  | {
      hideCloseButton: false;
      closeButtonOnClick: () => void;
    }
  | {
      hideCloseButton: true;
      closeButtonOnClick?: undefined;
    }
) & {
  children?: ReactNode;
  paddingTop: string;
};

export const Header = (props: HeaderProps) => {
  const { children, hideCloseButton, closeButtonOnClick, paddingTop } = props;
  const dispatch = useDispatch();

  return (
    <Flex
      $container={true}
      width={'100%'}
      padding={`${paddingTop} var(--margins-lg) var(--margins-md)`}
    >
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
        <SessionLucideIconButton
          iconSize={'medium'}
          unicode={LUCIDE_ICONS_UNICODE.X}
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
