import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { tr } from '../../localization/localeTools';

import {
  getScreenShareSources,
  openScreenRecordingSettings,
  setScreenShareSource,
  ScreenShareSource,
} from '../../util/screenShare';
import { SessionSpinner } from '../loading';
import { isMacOS } from '../../OS';

const StyledPanel = styled.dialog`
  width: fit-content;
  min-width: min(360px, 90vw);
  max-width: min(820px, 90vw);
  max-height: 80vh;
  padding: 20px;
  border-radius: var(--border-radius);
  background-color: var(--modal-background-content-color);
  border: var(--default-borders);
  box-shadow: var(--modal-drop-shadow);
  color: var(--text-primary-color);
  &::backdrop {
    background-color: rgba(0, 0, 0, 0.6);
  }
`;

const StyledTitle = styled.h2`
  margin: 0 0 12px 0;
  font-size: var(--font-size-lg);
`;

const StyledGrid = styled.div<{ $columns: number }>`
  display: grid;
  grid-template-columns: repeat(${props => props.$columns}, 180px);
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

  const dialog = useRef<HTMLDialogElement>(null);
  const picked = useRef(false);

  useEffect(() => {
    dialog.current?.showModal();
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
      if (!picked.current) {
        void setScreenShareSource(null);
      }
    };
  }, []);

  return (
    <StyledPanel
      ref={dialog}
      data-testid="screen-share-picker"
      aria-labelledby="call-share-title"
      onCancel={event => {
        event.preventDefault();
        onCancel();
      }}
      // Only reached when the overlay is not in DOM full screen: Electron handles Escape there.
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation();
        }
      }}
    >
      <StyledTitle id="call-share-title">{tr('callsShareScreen')}</StyledTitle>
      {loading && <SessionSpinner $loading={true} />}
      {permissionDenied && (
        <>
          <StyledMessage>
            {isMacOS()
              ? tr('callsScreenRecordingPermissionDescription')
              : tr('permissionsRequired')}
          </StyledMessage>
          {isMacOS() && (
            <StyledTextButton
              type="button"
              data-testid="screen-share-open-settings"
              onClick={() => void openScreenRecordingSettings()}
            >
              {tr('openSettings')}
            </StyledTextButton>
          )}
        </>
      )}
      {!loading && !permissionDenied && !sources.length && (
        <StyledMessage>{tr('callsShareScreenNoSources')}</StyledMessage>
      )}
      <StyledGrid $columns={Math.min(Math.max(sources.length, 1), 4)}>
        {sources.map(source => (
          <StyledSource
            key={source.id}
            type="button"
            data-testid="screen-share-source"
            title={source.name}
            onClick={() => {
              picked.current = true;
              onPicked(source.id);
            }}
          >
            {source.thumbnailDataUrl && <img src={source.thumbnailDataUrl} alt="" />}
            <span>{source.name}</span>
          </StyledSource>
        ))}
      </StyledGrid>
      <StyledFooter>
        <StyledTextButton type="button" data-testid="screen-share-cancel" onClick={onCancel}>
          {tr('cancel')}
        </StyledTextButton>
      </StyledFooter>
    </StyledPanel>
  );
};
