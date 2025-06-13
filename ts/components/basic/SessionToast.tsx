import styled from 'styled-components';

import { Flex } from './Flex';

import { SessionHtmlRenderer } from './SessionHTMLRenderer';
import { LucideIcon } from '../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

// NOTE We don't change the color strip on the left based on the type. 16/09/2022
export enum SessionToastType {
  Info = 'info',
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

type Props = {
  description: string;
  id?: string;
  type?: SessionToastType;
  closeToast?: any;
  onToastClick?: () => void;
};

const DescriptionDiv = styled.div`
  font-size: var(--font-size-sm);
  color: var(--text-primary-color);
  text-overflow: ellipsis;
  font-family: var(--font-default);
  padding-top: var(--margins-xs);
`;

const IconDiv = styled.div`
  flex-shrink: 0;
  padding-inline-end: var(--margins-xs);
  margin: 0 var(--margins-sm) 0 var(--margins-xs);
`;

function DescriptionPubkeysReplaced({ description }: { description: string }) {
  return (
    <DescriptionDiv>
      <SessionHtmlRenderer html={description} />
    </DescriptionDiv>
  );
}

export const SessionToast = (props: Props) => {
  const { description, type } = props;

  let toastIcon: LUCIDE_ICONS_UNICODE | undefined;
  if (!toastIcon) {
    switch (type) {
      case SessionToastType.Success:
        toastIcon = LUCIDE_ICONS_UNICODE.CHECK;
        break;
      case SessionToastType.Error:
        toastIcon = LUCIDE_ICONS_UNICODE.OCTAGON_ALERT;
        break;
      case SessionToastType.Warning:
        toastIcon = LUCIDE_ICONS_UNICODE.OCTAGON_X;
        break;
      case SessionToastType.Info:
      default:
        toastIcon = LUCIDE_ICONS_UNICODE.INFO;
    }
  }

  return (
    <Flex
      $container={true}
      $alignItems="center"
      onClick={props.onToastClick}
      data-testid="session-toast"
      padding="var(--margins-sm) 0"
    >
      <IconDiv>
        <LucideIcon iconSize="huge" unicode={toastIcon} />
      </IconDiv>
      <Flex
        $container={true}
        $justifyContent="flex-start"
        $flexDirection="column"
        className="session-toast"
      >
        <DescriptionPubkeysReplaced description={description} />
      </Flex>
    </Flex>
  );
};
