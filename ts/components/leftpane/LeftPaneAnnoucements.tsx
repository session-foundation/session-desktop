import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { getSortedAnnouncements } from '../../state/selectors/announcements';
import { announcementActions, type Announcement } from '../../state/ducks/announcements';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { Flex } from '../basic/Flex';
import { showLinkVisitWarningDialog } from '../dialog/OpenUrlModal';
import { Localizer } from '../basic/Localizer';

const StyledAnnouncementRow = styled.div<{ $canClick: boolean }>`
  padding: var(--margins-sm);
  border-bottom: 1px solid var(--border-color);
  background-color: var(--background-secondary-color);
  color: var(--text-primary-color);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  cursor: ${({ $canClick }) => ($canClick ? 'pointer' : 'default')};

  &:hover {
    background-color: var(--background-primary-color);
  }
`;

const StyledAnnouncementTitle = styled.div`
  font-size: var(--font-size-sm);
  font-weight: 500;
`;

const StyledAnnouncementDescription = styled.div`
  font-size: var(--font-size-xs);
`;

function Announcement({ announcement }: { announcement: Announcement }) {
  const dispatch = useDispatch();
  return (
    <StyledAnnouncementRow
      $canClick={!!announcement.link}
      onClick={e => {
        if (!announcement.link) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        showLinkVisitWarningDialog(announcement.link, dispatch);
      }}
    >
      <Flex $container={true} $alignItems="center" $flexGap="var(--margins-sm)" width="100%">
        <StyledAnnouncementTitle>
          <Localizer {...announcement.titleArgs} />
        </StyledAnnouncementTitle>
        <SessionLucideIconButton
          unicode={LUCIDE_ICONS_UNICODE.X}
          iconSize="small"
          onClick={e => {
            e?.preventDefault();
            e?.stopPropagation();

            dispatch(announcementActions.closeByKey(announcement.key));
          }}
          margin="0 0 0 auto"
        />
      </Flex>
      <StyledAnnouncementDescription>
        <Localizer {...announcement.descriptionArgs} />
      </StyledAnnouncementDescription>
    </StyledAnnouncementRow>
  );
}

export function LeftPaneAnnouncements() {
  const announcements = useSelector(getSortedAnnouncements);

  if (!announcements.length) {
    return null;
  }
  return announcements.map(a => {
    return <Announcement key={a.key} announcement={a} />;
  });
}
