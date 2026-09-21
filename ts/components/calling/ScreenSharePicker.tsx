import { useEffect, useState } from 'react';
import styled from 'styled-components';
import useKey from 'react-use/lib/useKey';

import {
  getScreenShareSources,
  openScreenRecordingSettings,
  ScreenShareSource,
} from '../../util/screenShare';
import { SessionSpinner } from '../loading';

/**
 * TODO(l10n): not in the session-localization project yet — see the note in CallButtons.tsx.
 */
const TITLE = 'Choose what to share';
const SCREENS_HEADING = 'Screens';
const WINDOWS_HEADING = 'Windows';
const CANCEL = 'Cancel';
const NO_SOURCES = 'Nothing available to share.';
const PERMISSION_NEEDED =
  'Session needs the Screen Recording permission before it can share your screen.';
const OPEN_SETTINGS = 'Open System Settings';

/**
 * `position: fixed` is relative to the fullscreen element when one is active, so the same picker
 * renders correctly whether the call is in full screen or in the conversation view.
 */
const StyledBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.6);
`;

const StyledPanel = styled.div`
  width: min(820px, 90vw);
  max-height: 80vh;
  overflow-y: auto;
  padding: 20px;
  border-radius: var(--border-radius);
  background-color: var(--modal-background-content-color);
  border: var(--default-borders);
  box-shadow: var(--modal-drop-shadow);
  color: var(--text-primary-color);
`;

const StyledTitle = styled.h2`
  margin: 0 0 12px 0;
  font-size: var(--font-size-lg);
`;

const StyledHeading = styled.h3`
  margin: 16px 0 8px 0;
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  color: var(--text-secondary-color);
`;

const StyledGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
`;

const StyledSource = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  cursor: pointer;
  background-color: var(--background-secondary-color);
  border: 2px solid transparent;
  border-radius: var(--border-radius);
  color: inherit;
  font-size: var(--font-size-xs);

  &:hover,
  &:focus-visible {
    border-color: var(--primary-color);
  }

  img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: contain;
    background-color: var(--black-color);
    border-radius: 4px;
  }

  span {
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
  }
`;

const StyledFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
`;

const StyledTextButton = styled.button`
  padding: 8px 16px;
  cursor: pointer;
  border-radius: var(--border-radius);
  border: var(--default-borders);
  background-color: transparent;
  color: var(--text-primary-color);

  &:hover {
    background-color: var(--background-secondary-color);
  }
`;

const StyledMessage = styled.p`
  margin: 12px 0;
  color: var(--text-secondary-color);
`;

/**
 * Session's own screen-share picker.
 *
 * Electron does not provide one, and the OS picker is only available on some platforms and OS
 * versions, so this is the single portable path: ask the main process for the shareable sources,
 * show them, and hand the chosen id back to the caller which then calls getDisplayMedia().
 */
export const ScreenSharePicker = ({
  onPicked,
  onCancel,
}: {
  onPicked: (sourceId: string) => void;
  onCancel: () => void;
}) => {
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<Array<ScreenShareSource>>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useKey('Escape', () => {
    onCancel();
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSources() {
      try {
        const result = await getScreenShareSources();
        if (cancelled) {
          return;
        }
        setPermissionDenied(result.screenAccess !== 'granted');
        setSources(result.sources);
      } catch (e) {
        if (!cancelled) {
          window.log?.warn('ScreenSharePicker could not list sources:', e?.message);
          setSources([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadSources();

    return () => {
      cancelled = true;
    };
  }, []);

  const screens = sources.filter(m => m.isScreen);
  const windows = sources.filter(m => !m.isScreen);

  const renderGroup = (heading: string, group: Array<ScreenShareSource>) => {
    if (!group.length) {
      return null;
    }
    return (
      <>
        <StyledHeading>{heading}</StyledHeading>
        <StyledGrid>
          {group.map(source => (
            <StyledSource
              key={source.id}
              type="button"
              onClick={() => {
                onPicked(source.id);
              }}
              title={source.name}
            >
              {source.thumbnailDataUrl ? (
                <img src={source.thumbnailDataUrl} alt="" />
              ) : (
                <img alt="" />
              )}
              <span>{source.name}</span>
            </StyledSource>
          ))}
        </StyledGrid>
      </>
    );
  };

  return (
    <StyledBackdrop
      onClick={e => {
        // only a click on the backdrop itself cancels, never one that came from the panel
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <StyledPanel>
        <StyledTitle>{TITLE}</StyledTitle>
        {loading ? (
          <SessionSpinner $loading={true} />
        ) : (
          <>
            {permissionDenied ? (
              <>
                <StyledMessage>{PERMISSION_NEEDED}</StyledMessage>
                <StyledTextButton
                  type="button"
                  onClick={() => {
                    void openScreenRecordingSettings();
                  }}
                >
                  {OPEN_SETTINGS}
                </StyledTextButton>
              </>
            ) : null}
            {!permissionDenied && !sources.length ? (
              <StyledMessage>{NO_SOURCES}</StyledMessage>
            ) : null}
            {renderGroup(SCREENS_HEADING, screens)}
            {renderGroup(WINDOWS_HEADING, windows)}
          </>
        )}
        <StyledFooter>
          <StyledTextButton type="button" onClick={onCancel}>
            {CANCEL}
          </StyledTextButton>
        </StyledFooter>
      </StyledPanel>
    </StyledBackdrop>
  );
};
