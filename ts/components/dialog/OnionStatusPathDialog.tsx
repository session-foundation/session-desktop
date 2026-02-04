import { ipcRenderer } from 'electron';
import { useState, SessionDataTestId, type JSX } from 'react';

import useUpdate from 'react-use/lib/useUpdate';
import useHover from 'react-use/lib/useHover';
import styled from 'styled-components';
import useInterval from 'react-use/lib/useInterval';

import { isEmpty, isTypedArray } from 'lodash';
import { CityResponse, Reader } from 'maxmind';
import useMount from 'react-use/lib/useMount';
import { useSelector } from 'react-redux';
import { getAppDispatch } from '../../state/dispatch';
import { onionPathModal, updateOpenUrlModal } from '../../state/ducks/modalDialog';
import {
  getFirstOnionPathLength,
  getIsOnline,
  getOnionPathsCount,
  useFirstOnionPath,
} from '../../state/selectors/onions';
import { Flex } from '../basic/Flex';

import { Snode } from '../../data/types';
import { SessionSpinner } from '../loading';
import { getCrowdinLocale } from '../../util/i18n/shared';
import { tr } from '../../localization/localeTools';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { SessionButton, SessionButtonType } from '../basic/SessionButton';
import { ModalDescription } from './shared/ModalDescriptionContainer';
import { ModalFlexContainer } from './shared/ModalFlexContainer';
import { getDataFeatureFlagMemo } from '../../state/ducks/types/releasedFeaturesReduxTypes';
import { DURATION } from '../../session/constants';
import { createButtonOnKeyDownForClickEventHandler } from '../../util/keyboardShortcuts';

type StatusLightType = {
  glowing?: boolean;
  color: string;
  dataTestId?: SessionDataTestId;
};

const StyledCountry = styled.div`
  margin: var(--margins-sm);
  min-width: 150px;
`;

const StyledOnionNodeList = styled.div`
  display: flex;
  flex-direction: column;
  margin: var(--margins-sm);
  align-items: center;
  min-width: 10vw;
  position: relative;
`;

const StyledVerticalLine = styled.div`
  background: var(--borders-color);
  position: absolute;
  height: calc(100% - 2 * 15px);
  margin: 15px calc(100% / 2 - 1px);

  width: 1px;
`;

const StyledLightsContainer = styled.div`
  position: relative;
`;

const StyledGrowingIcon = styled.div`
  flex-grow: 1;
  display: flex;
  align-items: center;
`;

function useOnionPathWithUsAndNetwork() {
  const onionPath = useFirstOnionPath();
  const localDevnet = getDataFeatureFlagMemo('useLocalDevNet');

  if (onionPath.length === 0) {
    return [];
  }

  return [
    {
      label: tr('you'),
    },
    ...onionPath.map((node, index) => {
      return {
        ...node,
        label: localDevnet ? `SeshNet ${index + 1}` : undefined,
      };
    }),
    {
      label: tr('onionRoutingPathDestination'),
    },
  ];
}

function useGlowingIndex() {
  const [glowingIndex, setGlowingIndex] = useState(0);
  return { glowingIndex, setGlowingIndex };
}

function GlowingNodes() {
  const onionPath = useOnionPathWithUsAndNetwork();
  const { glowingIndex, setGlowingIndex } = useGlowingIndex();

  const increment = () => {
    setGlowingIndex(prev => (prev + 1) % onionPath.length);
  };

  useInterval(increment, 1 * DURATION.SECONDS);

  return onionPath.map((_, index) => {
    return <OnionNodeStatusLight glowing={index === glowingIndex} key={`light-${index}`} />;
  });
}

const OnionCountryDisplay = ({ labelText, snodeIp }: { snodeIp?: string; labelText: string }) => {
  const element = (hovered: boolean) => (
    <StyledCountry>{hovered && snodeIp ? snodeIp : labelText}</StyledCountry>
  );
  return useHover(element);
};

let reader: Reader<CityResponse> | null;

function loadCityData(forceUpdate: () => void) {
  ipcRenderer.once('load-maxmind-data-complete', (_event, content) => {
    const asArrayBuffer = content as Uint8Array;

    if (asArrayBuffer && isTypedArray(asArrayBuffer) && !isEmpty(asArrayBuffer)) {
      reader = new Reader<CityResponse>(Buffer.from(asArrayBuffer.buffer));
      forceUpdate();
    }
  });
  ipcRenderer.send('load-maxmind-data');
}

// NOTE: [react-compiler] this has to live here for the hook to be identified as static
function useIsOnline() {
  return useSelector(getIsOnline);
}

const OnionPathModalInner = () => {
  const forceUpdate = useUpdate();
  const nodes = useOnionPathWithUsAndNetwork();
  const isOnline = useIsOnline();

  useMount(() => {
    if (!reader) {
      loadCityData(forceUpdate);
    }
  });

  if (!isOnline || !nodes || nodes.length <= 0 || !reader) {
    return <SessionSpinner $loading={true} />;
  }

  return <OnionPathModalLoaded />;
};

const OnionPathModalLoaded = () => {
  const nodes = useOnionPathWithUsAndNetwork();
  return (
    <ModalFlexContainer>
      <ModalDescription
        dataTestId="modal-description"
        localizerProps={{ token: 'onionRoutingPathDescription' }}
      />
      <StyledOnionNodeList>
        <Flex $container={true}>
          <StyledLightsContainer>
            <StyledVerticalLine />
            <Flex $container={true} $flexDirection="column" $alignItems="center" height="100%">
              <GlowingNodes />
            </Flex>
          </StyledLightsContainer>
          <Flex $container={true} $flexDirection="column" $alignItems="flex-start">
            {nodes.map((snode: Snode | any) => {
              const country = reader?.get(snode.ip || '0.0.0.0')?.country;
              const locale = getCrowdinLocale();

              // typescript complains that the [] operator cannot be used with the 'string' coming from getCrowdinLocale()
              const countryNamesAsAny = country?.names as any;
              const countryName =
                snode.label || // to take care of the "Device" case
                countryNamesAsAny?.[locale] || // try to find the country name based on the user local first
                // eslint-disable-next-line dot-notation
                countryNamesAsAny?.['en'] || // if not found, fallback to the country in english
                tr('onionRoutingPathUnknownCountry');

              return (
                <OnionCountryDisplay
                  labelText={countryName}
                  snodeIp={snode.ip}
                  key={snode.ip ? `country-${snode.ip}` : countryName}
                />
              );
            })}
          </Flex>
        </Flex>
      </StyledOnionNodeList>
    </ModalFlexContainer>
  );
};

type OnionNodeStatusLightType = {
  glowing: boolean;
  dataTestId?: SessionDataTestId;
};

/**
 * Component containing a coloured status light.
 */
const OnionNodeStatusLight = (props: OnionNodeStatusLightType): JSX.Element => {
  const { glowing, dataTestId } = props;

  return (
    <ModalStatusLight
      glowing={glowing}
      color={'var(--button-path-default-color)'}
      dataTestId={dataTestId}
    />
  );
};

/**
 * An icon with a pulsating glow emission.
 */
const ModalStatusLight = (props: StatusLightType) => {
  const { glowing, color } = props;

  return (
    <StyledGrowingIcon>
      <OnionPathDot iconColor={color} glowing={glowing} />
    </StyledGrowingIcon>
  );
};

function OnionPathDot({
  dataTestId,
  iconColor,
  glowing,
}: {
  dataTestId?: SessionDataTestId;
  iconColor: string;
  glowing?: boolean;
}) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 100 100"
      clipRule="nonzero"
      fillRule="nonzero"
      data-testid={dataTestId}
      style={{
        transition: 'all var(--default-duration) ease-in-out',

        filter: glowing
          ? `drop-shadow(0px 0px 4px ${iconColor})`
          : `drop-shadow(0px 0px 6px ${iconColor})`,
        scale: glowing ? '1.3' : '1',
      }}
    >
      <path fill={iconColor} d="M 0, 50a 50,50 0 1,1 100,0a 50,50 0 1,1 -100,0"></path>
    </svg>
  );
}

export const OnionPathModal = () => {
  const dispatch = getAppDispatch();
  return (
    <SessionWrapperModal
      modalId="onionPathModal"
      onClose={() => dispatch(onionPathModal(null))}
      headerChildren={<ModalBasicHeader title={tr('onionRoutingPath')} showExitIcon={true} />}
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Simple}>
          <SessionButton
            text={tr('learnMore')}
            buttonType={SessionButtonType.Simple}
            onClick={() => {
              dispatch(
                updateOpenUrlModal({
                  urlToOpen: 'https://getsession.org/faq/#onion-routing',
                })
              );
            }}
          />
        </ModalActionsContainer>
      }
    >
      <OnionPathModalInner />
    </SessionWrapperModal>
  );
};

// Set icon color based on result
const errorColor = 'var(--button-path-error-color)';
const defaultColor = 'var(--button-path-default-color)';
const connectingColor = 'var(--button-path-connecting-color)';

const StyledStatusLightContainer = styled.div<{ $inActionPanel: boolean }>`
  margin-top: ${props => (props.$inActionPanel ? 'auto' : '0')};
  cursor: ${props => (props.$inActionPanel ? 'pointer' : 'inherit')};
  padding: ${props => (props.$inActionPanel ? 'var(--margins-lg)' : '0')};
  border-radius: 50%;
`;

// NOTE: [react-compiler] this has to live here for the hook to be identified as static
function useOnionPathsCount() {
  return useSelector(getOnionPathsCount);
}

// NOTE: [react-compiler] this has to live here for the hook to be identified as static
function useFirstOnionPathLength() {
  return useSelector(getFirstOnionPathLength);
}

/**
 * A status light specifically for the action panel. Color is based on aggregate node states instead of individual onion node state
 */
export const OnionStatusLight = (
  props:
    | { inActionPanel: true; handleClick: () => void }
    | {
        inActionPanel: false;
        handleClick: undefined;
      }
) => {
  const { handleClick, inActionPanel } = props;

  const onionPathsCount = useOnionPathsCount();
  const firstPathLength = useFirstOnionPathLength();
  const isOnline = useIsOnline();

  // start with red
  let iconColor = errorColor;
  // if we are not online or the first path is not valid, we keep red as color
  if (isOnline && firstPathLength > 1) {
    iconColor =
      onionPathsCount >= 2 ? defaultColor : onionPathsCount >= 1 ? connectingColor : errorColor;
  }

  const onKeyDown = handleClick
    ? createButtonOnKeyDownForClickEventHandler(handleClick)
    : undefined;

  return (
    <StyledStatusLightContainer
      data-testid="path-light-container"
      onClick={handleClick}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={0}
      $inActionPanel={inActionPanel}
    >
      <OnionPathDot dataTestId="path-light-svg" iconColor={iconColor} />
    </StyledStatusLightContainer>
  );
};
