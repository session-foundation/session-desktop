import styled from 'styled-components';
import { getAppDispatch } from '../../../../state/dispatch';

import { MessageRenderingProps, type MessageModelType } from '../../../../models/messageType';
import {
  useMessageAttachments,
  useMessageDirection,
  useMessageLinkPreview,
} from '../../../../state/selectors';
import { useIsMessageSelectionMode } from '../../../../state/selectors/selectedConversation';
import { isImageAttachment } from '../../../../types/Attachment';
import { Image } from '../../Image';
import { showLinkVisitWarningDialog } from '../../../dialog/OpenUrlModal';
import { AriaLabels } from '../../../../util/hardcodedAriaLabels';
import { LucideIcon } from '../../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { createButtonOnKeyDownForClickEventHandler } from '../../../../util/keyboardShortcuts';
import { focusVisibleBoxShadowOutset } from '../../../../styles/focusVisible';

export type MessageLinkPreviewSelectorProps = Pick<
  MessageRenderingProps,
  'direction' | 'attachments' | 'previews'
>;

type Props = {
  handleImageError: () => void;
  messageId: string;
};

const linkPreviewsImageSize = 100;

const StyledLinkPreviewTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.15px;
  line-height: 22px;

  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const StyledLinkPreviewLocation = styled.div`
  margin-top: 4px;
  font-size: 12px;
  height: 16px;
  letter-spacing: 0.4px;
  line-height: 16px;
`;

const StyledLinkPreviewLocationWithIconCircleBg = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  height: 32px;
  width: 32px;
  border-radius: 50%;
  background-color: var(--message-link-preview-background-color);
`;

const StyledIconContainerInner = styled.div`
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;

  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledIconContainer = styled.div`
  display: flex;
  justify-content: center;
  flex: initial;
  width: 100px;
  height: 100px;
  position: relative;
  margin-left: -2px;
  margin-inline-end: 8px;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const StyledImageContainer = styled.div`
  margin-inline-end: 8px;
  display: inline-block;
`;

const StyledPreviewContent = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-grow: 1;
  margin-right: var(--margins-sm);
`;

const StyledMessageLinkPreview = styled.div<{ $direction: MessageModelType | undefined }>`
  cursor: pointer;
  display: flex;
  align-items: center;
  border-radius: var(--border-radius-message-box);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  background-color: var(--message-link-preview-background-color);
  margin: var(--padding-link-preview);

  .module-image {
    margin: 0;
    border-radius: 0;
    border-top-left-radius: var(--border-radius-message-box);
  }

  ${props =>
    props.$direction === 'incoming'
      ? 'color: var(--message-bubble-incoming-text-color);'
      : 'color: var(--message-bubble-outgoing-text-color);'}

  ${props =>
    props.$direction === 'incoming'
      ? '--focus-ring-color: ;'
      : '--focus-ring-color: var(--text-primary-color);'}


  ${focusVisibleBoxShadowOutset()}
`;

export const MessageLinkPreview = (props: Props) => {
  const dispatch = getAppDispatch();
  const direction = useMessageDirection(props.messageId);
  const attachments = useMessageAttachments(props.messageId);
  const previews = useMessageLinkPreview(props.messageId);
  const isMessageSelectionMode = useIsMessageSelectionMode();

  if (!props.messageId) {
    return null;
  }

  // Attachments take precedence over Link Previews
  if (attachments && attachments.length) {
    return null;
  }

  if (!previews || previews.length < 1) {
    return null;
  }

  const first = previews[0];
  if (!first) {
    return null;
  }

  const previewHasImage = first.image && isImageAttachment(first.image);

  function openLinkFromPreview() {
    if (isMessageSelectionMode) {
      return;
    }
    if (previews?.length && previews[0].url) {
      showLinkVisitWarningDialog(previews[0].url, dispatch);
    }
  }

  const onKeyDown = createButtonOnKeyDownForClickEventHandler(openLinkFromPreview);

  return (
    <StyledMessageLinkPreview
      role="button"
      tabIndex={0}
      onClick={openLinkFromPreview}
      onKeyDown={onKeyDown}
      $direction={direction}
    >
      <StyledPreviewContent>
        {previewHasImage ? (
          <StyledImageContainer>
            <Image
              softCorners={true}
              alt={AriaLabels.imageLinkPreview}
              height={linkPreviewsImageSize}
              width={linkPreviewsImageSize}
              url={first.image.url}
              attachment={first.image}
              onError={props.handleImageError}
            />
          </StyledImageContainer>
        ) : (
          <StyledIconContainer>
            <StyledIconContainerInner>
              <StyledLinkPreviewLocationWithIconCircleBg>
                <LucideIcon unicode={LUCIDE_ICONS_UNICODE.LINK} iconSize="small" />
              </StyledLinkPreviewLocationWithIconCircleBg>
            </StyledIconContainerInner>
          </StyledIconContainer>
        )}
        <div>
          <StyledLinkPreviewTitle data-testid="msg-link-preview-title">
            {first.title}
          </StyledLinkPreviewTitle>
          <StyledLinkPreviewLocation>{first.domain}</StyledLinkPreviewLocation>
        </div>
      </StyledPreviewContent>
    </StyledMessageLinkPreview>
  );
};
