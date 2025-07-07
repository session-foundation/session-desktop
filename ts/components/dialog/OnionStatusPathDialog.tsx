import { ipcRenderer, shell } from 'electron';
import { useState, SessionDataTestId } from 'react';

import { useDispatch } from 'react-redux';
import useHover from 'react-use/lib/useHover';
import styled from 'styled-components';
import useInterval from 'react-use/lib/useInterval';

import { isEmpty, isTypedArray } from 'lodash';
import { CityResponse, Reader } from 'maxmind';
import useMount from 'react-use/lib/useMount';
import { onionPathModal } from '../../state/ducks/modalDialog';
import {
  useFirstOnionPath,
  useFirstOnionPathLength,
  useIsOnline,
  useOnionPathsCount,
} from '../../state/selectors/onions';
import { Flex } from '../basic/Flex';

import { Snode } from '../../data/types';
import { SessionSpinner } from '../loading';
import { getCrowdinLocale } from '../../util/i18n/shared';
import { localize } from '../../localization/localeTools';
import { ButtonChildrenContainer, SessionWrapperModal2 } from '../SessionWrapperModal2';
import { SessionButton, SessionButtonType } from '../basic/SessionButton';
import { StyledModalDescriptionContainer } from './shared/ModalDescriptionContainer';

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
  background: var(--border-color);
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

  if (onionPath.length === 0) {
    return [];
  }

  return [
    {
      label: localize('you').toString(),
    },
    ...onionPath,
    {
      label: localize('onionRoutingPathDestination').toString(),
    },
  ];
}

function GlowingNodes() {
  const onionPath = useOnionPathWithUsAndNetwork();
  const countDotsTotal = onionPath.length;

  const [glowingIndex, setGlowingIndex] = useState(0);
  useInterval(() => {
    setGlowingIndex((glowingIndex + 1) % countDotsTotal);
  }, 1000);

  return onionPath.map((_snode: Snode | any, index: number) => {
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

const OnionPathModalInner = () => {
  const nodes = useOnionPathWithUsAndNetwork();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_dataLoaded, setDataLoaded] = useState(false);
  const isOnline = useIsOnline();

  useMount(() => {
    ipcRenderer.once('load-maxmind-data-complete', (_event, content) => {
      const asArrayBuffer = content as Uint8Array;
      if (asArrayBuffer && isTypedArray(asArrayBuffer) && !isEmpty(asArrayBuffer)) {
        reader = new Reader<CityResponse>(Buffer.from(asArrayBuffer.buffer));
        setDataLoaded(true); // retrigger a rerender
      }
    });
    ipcRenderer.send('load-maxmind-data');
  });

  if (!isOnline || !nodes || nodes.length <= 0) {
    return <SessionSpinner loading={true} />;
  }

  return (
    <>
      <StyledModalDescriptionContainer>
        {localize('onionRoutingPathDescription')}
      </StyledModalDescriptionContainer>
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
                localize('onionRoutingPathUnknownCountry').toString();

              return (
                <OnionCountryDisplay
                  labelText={countryName}
                  snodeIp={snode.ip}
                  key={`country-${snode.ip}`}
                />
              );
            })}
          </Flex>
        </Flex>
      </StyledOnionNodeList>
    </>
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

// Set icon color based on result
const errorColor = 'var(--button-path-error-color)';
const defaultColor = 'var(--button-path-default-color)';
const connectingColor = 'var(--button-path-connecting-color)';

const OnionPathContainer = styled.button`
  display: flex;
  padding: var(--margins-lg);
`;

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
      clip-rule="nonzero"
      fill-rule="nonzero"
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

/**
 * A status light specifically for the action panel. Color is based on aggregate node states instead of individual onion node state
 */
export const ActionPanelOnionStatusLight = (props: { handleClick: () => void; id: string }) => {
  const { handleClick, id } = props;

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

  return (
    <OnionPathContainer id={id} data-testid="path-light-container" onClick={handleClick}>
      <OnionPathDot dataTestId="path-light-svg" iconColor={iconColor} />
    </OnionPathContainer>
  );
};

export const OnionPathModal = () => {
  const dispatch = useDispatch();
  return (
    <SessionWrapperModal2
      title={localize('onionRoutingPath').toString()}
      onClose={() => dispatch(onionPathModal(null))}
      showExitIcon={true}
      buttonChildren={
        <ButtonChildrenContainer>
          <SessionButton
            text={localize('learnMore').toString()}
            buttonType={SessionButtonType.Simple}
            onClick={() => {
              void shell.openExternal('https://getsession.org/faq/#onion-routing');
            }}
          />
        </ButtonChildrenContainer>
      }
    >
      <OnionPathModalInner />
    </SessionWrapperModal2>
  );
};
