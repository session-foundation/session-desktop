import { noop } from 'lodash';

import styled from 'styled-components';

import { Flex } from './Flex';

import { SessionIcon, SessionIconType } from '../icon';
import { SessionHtmlRenderer } from './SessionHTMLRenderer';

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
  icon?: SessionIconType;
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
  const { description, type, icon } = props;

  const toastDesc = description || '';
  const toastIconSize = toastDesc ? 'huge' : 'medium';

  // Set a custom icon or allow the theme to define the icon
  let toastIcon = icon || undefined;
  if (!toastIcon) {
    switch (type) {
      case SessionToastType.Info:
        toastIcon = 'info';
        break;
      case SessionToastType.Success:
        toastIcon = 'check';
        break;
      case SessionToastType.Error:
        toastIcon = 'error';
        break;
      case SessionToastType.Warning:
        toastIcon = 'warning';
        break;
      default:
        toastIcon = 'info';
    }
  }

  const onToastClick = props?.onToastClick || noop;

  return (
    <Flex
      container={true}
      alignItems="center"
      onClick={onToastClick}
      data-testid="session-toast"
      padding="var(--margins-sm) 0"
    >
      <IconDiv>
        <SessionIcon iconType={toastIcon} iconSize={toastIconSize} />
      </IconDiv>
      <Flex
        container={true}
        justifyContent="flex-start"
        flexDirection="column"
        className="session-toast"
      >
        <DescriptionPubkeysReplaced description={toastDesc} />
      </Flex>
    </Flex>
  );
};
