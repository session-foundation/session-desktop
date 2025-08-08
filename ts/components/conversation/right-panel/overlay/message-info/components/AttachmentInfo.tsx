import styled from 'styled-components';
import { LabelWithInfo } from '.';
import { PropsForAttachment } from '../../../../../../state/ducks/conversations';
import { Flex } from '../../../../../basic/Flex';
import { tr } from '../../../../../../localization/localeTools';
import { saveLogToDesktop } from '../../../../../../util/logger/renderer_process_logging';

type Props = {
  attachment: PropsForAttachment;
};

const StyledLabelContainer = styled(Flex)`
  div {
    // we want 2 items per row and that's the easiest to make it happen
    min-width: 50%;
  }
`;

function formatAttachmentUrl(attachment: PropsForAttachment) {
  // Note: desktop overwrites the url with the local path once the file is downloaded,
  // and I think this is how we know the file was downloaded.

  if (!attachment?.url) {
    return tr('attachmentsNa');
  }

  if (!attachment.url.startsWith('http')) {
    return tr('attachmentsNa');
  }

  const fileId = attachment.url.split('/').pop() || '';

  if (!fileId) {
    return tr('attachmentsNa');
  }

  return fileId;
}

export const AttachmentInfo = (props: Props) => {
  const { attachment } = props;

  // NOTE the attachment.url will be an empty string if the attachment is broken
  const hasError = attachment.error || attachment.url === '';

  return (
    <Flex $container={true} $flexDirection="column" $flexGap="var(--margins-xs)">
      <LabelWithInfo label={tr('attachmentsFileId')} info={formatAttachmentUrl(attachment)} />
      <StyledLabelContainer $container={true} $flexDirection="row" $flexWrap="wrap">
        <LabelWithInfo
          label={tr('attachmentsFileType')}
          info={attachment?.contentType ? String(attachment.contentType) : tr('attachmentsNa')}
        />
        <LabelWithInfo
          label={tr('attachmentsFileSize')}
          info={attachment?.fileSize ? String(attachment.fileSize) : tr('attachmentsNa')}
        />
        <LabelWithInfo
          label={tr('attachmentsResolution')}
          info={
            attachment?.width && attachment.height
              ? `${attachment.width}x${attachment.height}`
              : tr('attachmentsNa')
          }
        />
        <LabelWithInfo
          label={tr('attachmentsDuration')}
          info={attachment?.duration ? attachment.duration : tr('attachmentsNa')}
        />
        {hasError ? (
          <LabelWithInfo
            title={tr('helpReportABugExportLogsDescription')}
            label={`${tr('attachment')} ${tr('theError')}:`}
            info={tr('errorUnknown')}
            dataColor={'var(--danger-color)'}
            onClick={() => {
              void saveLogToDesktop();
            }}
          />
        ) : null}
      </StyledLabelContainer>
    </Flex>
  );
};
