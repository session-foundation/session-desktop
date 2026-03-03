import type { SessionDataTestId } from 'react';
import styled from 'styled-components';
import type { SessionIconSize } from './Icons';
import { IconSizeToPxStr } from './SessionIcon';

const MailWithUnreadContainer = styled.div`
  position: relative;
`;

export function MailWithUnreadIcon({
  iconSize,
  style,
  dataTestId,
}: {
  iconSize: SessionIconSize;
  dataTestId?: SessionDataTestId;
  style?: React.CSSProperties;
}) {
  const sizePx = IconSizeToPxStr[iconSize];
  return (
    <MailWithUnreadContainer style={style}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={sizePx}
        height={sizePx}
        fill="none"
        viewBox="0 0 17 17"
        data-testid={dataTestId}
      >
        <path
          fill="currentColor"
          fill-rule="evenodd"
          d="M1.052 2.468a2.125 2.125 0 0 1 1.503-.622h11.333a2.125 2.125 0 0 1 2.125 2.125v4.924a.708.708 0 1 1-1.417 0V3.971a.708.708 0 0 0-.708-.709H2.555a.708.708 0 0 0-.709.709v8.5c0 .388.32.708.709.708h7.666a.708.708 0 0 1 0 1.417H2.555A2.13 2.13 0 0 1 .43 12.47v-8.5c0-.564.223-1.104.622-1.503Z"
          clip-rule="evenodd"
        />
        <path
          fill="currentColor"
          fill-rule="evenodd"
          d="M.54 4.3a.708.708 0 0 1 .978-.219l6.351 4.036a.666.666 0 0 0 .704 0h.002l6.35-4.036a.708.708 0 1 1 .76 1.196l-6.358 4.04a2.082 2.082 0 0 1-2.211 0l-.004-.003L.758 5.277a.708.708 0 0 1-.218-.978Z"
          clip-rule="evenodd"
        />
        <path
          fill="var(--primary-color)"
          fill-rule="evenodd"
          d="M14.122 10.232a2.449 2.449 0 0 1 2.448 2.449v.024a2.449 2.449 0 1 1-4.897 0v-.024a2.449 2.449 0 0 1 2.449-2.449Z"
          clip-rule="evenodd"
        />
      </svg>
    </MailWithUnreadContainer>
  );
}
