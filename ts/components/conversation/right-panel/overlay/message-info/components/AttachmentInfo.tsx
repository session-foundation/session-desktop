import styled from 'styled-components';
import { LabelWithInfo } from '.';
import { PropsForAttachment } from '../../../../../../state/ducks/conversations';
import { Flex } from '../../../../../basic/Flex';
import { tr } from '../../../../../../localization/localeTools';
import { saveLogToDesktop } from '../../../../../../util/logger/renderer_process_logging';
import { extractDetailsFromUrlFragment } from '../../../../../../session/url';
import { isDevProd } from '../../../../../../shared/env_vars';

type Props = {
  attachment: PropsForAttachment;
};

const StyledLabelContainer = styled(Flex)`
  div {
    // we want 2 items per row and that's the easiest to make it happen
    min-width: 50%;
  }
`;

function formatAttachmentUrl(attachment: Pick<PropsForAttachment, 'url'>) {
  // Note: desktop overwrites the url with the local path once the file is downloaded,
  // and I think this is how we know the file was downloaded.

  if (!attachment?.url) {
    return tr('attachmentsNa');
  }

  if (!attachment.url.startsWith('http')) {
    return tr('attachmentsNa');
  }

  const fileUrl = URL.canParse(attachment.url) && new URL(attachment.url);
  const fileId = fileUrl ? fileUrl?.pathname.split('/').pop() || '' : '';

  if (!fileId) {
    return tr('attachmentsNa');
  }

  return fileId;
}

function extractAttachmentDetails(attachment: Pick<PropsForAttachment, 'url'>) {
  const fileUrl = URL.canParse(attachment?.url) && new URL(attachment.url);
  return {
    deterministicEncryption:
      (fileUrl && extractDetailsFromUrlFragment(fileUrl)?.deterministicEncryption) || false,
    fsHost: fileUrl ? fileUrl.hostname : tr('attachmentsNa'),
  };
}

export const AttachmentInfo = (props: Props) => {
  const { attachment } = props;

  // NOTE the attachment.url will be an empty string if the attachment is broken
  const hasError = attachment.error || attachment.url === '';

  const { deterministicEncryption, fsHost } = extractAttachmentDetails(attachment);

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
        {isDevProd() ? (
          <>
            <LabelWithInfo
              label="Uses Deterministic Encryption"
              info={deterministicEncryption ? 'Yes' : 'No'}
            />
            <LabelWithInfo label="Fs host" info={fsHost} />
          </>
        ) : null}
      </StyledLabelContainer>
    </Flex>
  );
};
