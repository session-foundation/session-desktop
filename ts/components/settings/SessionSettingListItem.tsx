import styled from 'styled-components';

import { shell } from 'electron';
import { isEmpty, pick } from 'lodash';
import { ReactNode, type SessionDataTestId } from 'react';
import { Flex } from '../basic/Flex';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonShape,
  SessionButtonType,
} from '../basic/SessionButton';
import { SessionToggle } from '../basic/SessionToggle';
import { SpacerSM } from '../basic/Text';
import { SessionIcon, SessionIconProps } from '../icon';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

type ButtonSettingsProps = {
  title?: string;
  description?: string;
  buttonColor?: SessionButtonColor;
  buttonType?: SessionButtonType;
  buttonShape?: SessionButtonShape;
  buttonText: string;
  dataTestId?: SessionDataTestId;
  onClick: () => void;
};

export const StyledDescriptionSettingsItem = styled.div`
  font-family: var(--font-default);
  font-size: var(--font-size-sm);
  font-weight: 400;
`;

export const StyledTitleSettingsItem = styled.div`
  line-height: 1.7;
  font-size: var(--font-size-lg);
  font-weight: bold;
`;

const StyledInfo = styled.div`
  padding-inline-end: var(--margins-lg);
`;

const StyledDescriptionContainer = styled(StyledDescriptionSettingsItem)`
  display: flex;
  align-items: center;
`;

export const StyledSettingItem = styled.div`
  font-size: var(--font-size-md);
  padding: var(--margins-lg);
  margin-bottom: var(--margins-lg);

  background: var(--settings-tab-background-color);
  color: var(--settings-tab-text-color);
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
`;

const StyledSettingItemInline = styled(StyledSettingItem)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: var(--default-duration);
  button {
    flex-shrink: 0;
  }
`;

const StyledSettingItemClickable = styled(StyledSettingItemInline)`
  cursor: pointer;
  &:hover {
    background: var(--settings-tab-background-hover-color);
  }
  &:active {
    background: var(--settings-tab-background-selected-color);
  }
`;

export const SettingsTitleAndDescription = (props: {
  title?: ReactNode;
  description?: ReactNode;
  childrenDescription?: ReactNode;
  icon?: SessionIconProps;
}) => {
  const { description, childrenDescription, title, icon } = props;
  return (
    <StyledInfo>
      <Flex
        $container={true}
        $flexDirection={'row'}
        $justifyContent={'flex-start'}
        $alignItems={'center'}
      >
        <StyledTitleSettingsItem>{title}</StyledTitleSettingsItem>
        {!isEmpty(icon) ? (
          <>
            <SpacerSM />
            <SessionIcon {...pick(icon, ['iconType', 'iconSize', 'iconColor'])} />
          </>
        ) : null}
      </Flex>
      <StyledDescriptionContainer>
        {description && (
          <StyledDescriptionSettingsItem>{description}</StyledDescriptionSettingsItem>
        )}
        <>{childrenDescription}</>
      </StyledDescriptionContainer>
    </StyledInfo>
  );
};

export const SessionSettingsItemWrapper = (props: {
  inline: boolean;
  title?: ReactNode;
  icon?: SessionIconProps;
  description?: ReactNode;
  children?: ReactNode;
  childrenDescription?: ReactNode;
}) => {
  const { inline, children, description, title, childrenDescription, icon } = props;
  const ComponentToRender = inline ? StyledSettingItemInline : StyledSettingItem;
  return (
    <ComponentToRender>
      <SettingsTitleAndDescription
        title={title}
        description={description}
        childrenDescription={childrenDescription}
        icon={icon}
      />
      {children}
    </ComponentToRender>
  );
};

export const SessionSettingsTitleWithLink = (props: { title: string; link: string }) => {
  const { title, link } = props;
  return (
    <StyledSettingItemClickable
      onClick={() => {
        void shell.openExternal(link);
      }}
    >
      <SettingsTitleAndDescription title={title} />
      <SessionLucideIconButton
        title={link}
        iconSize={'large'}
        unicode={LUCIDE_ICONS_UNICODE.EXTERNAL_LINK_ICON}
        isSelected={true}
      />
    </StyledSettingItemClickable>
  );
};

export const SessionToggleWithDescription = (props: {
  title?: string;
  description?: string;
  active: boolean;
  onClickToggle: () => void;
  childrenDescription?: ReactNode; // if set, those elements will be appended next to description field (only used for typing message settings as of now)
  dataTestId?: SessionDataTestId;
}) => {
  const { title, description, active, onClickToggle, childrenDescription, dataTestId } = props;

  return (
    <SessionSettingsItemWrapper
      title={title}
      description={description}
      inline={true}
      childrenDescription={childrenDescription}
    >
      <SessionToggle active={active} onClick={onClickToggle} dataTestId={dataTestId} />
    </SessionSettingsItemWrapper>
  );
};

export const SessionSettingButtonItem = (props: ButtonSettingsProps) => {
  const {
    title,
    description,
    buttonColor,
    buttonType,
    buttonShape,
    buttonText,
    dataTestId,
    onClick,
  } = props;

  return (
    <SessionSettingsItemWrapper title={title} description={description} inline={true}>
      <SessionButton
        dataTestId={dataTestId}
        text={buttonText}
        buttonColor={buttonColor}
        buttonType={buttonType}
        buttonShape={buttonShape}
        onClick={onClick}
      />
    </SessionSettingsItemWrapper>
  );
};
