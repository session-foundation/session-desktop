import styled from 'styled-components';
import { Fragment } from 'react/jsx-runtime';
import { H2 } from '../basic/Heading';
import { getAppDispatch } from '../../state/dispatch';
import { updateKeyboardShortcutsMenuModal } from '../../state/ducks/modalDialog';
import { ModalBasicHeader, SessionWrapperModal, WrapperModalWidth } from '../SessionWrapperModal';
import { Flex } from '../basic/Flex';
import { ctrlKeyName, KbdShortcutInformation } from '../../util/keyboardShortcuts';

const Container = styled.div`
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: var(--margins-lg);
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--margins-sm);
`;

const StyledShortcut = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 4px;

  &:hover {
    background-color: var(--background-modifier-hover);
  }
`;

const ShortcutLabel = styled.span`
  font-size: 14px;
  color: var(--text-primary-color);
`;

const KeysContainer = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;
  select: all;
`;

const Key = styled.kbd`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background-color: var(--background-primary-color);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  box-shadow: inset 0 -2px 0 0 var(--border-color);
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-weight: 600;
  color: var(--text-primary-color);
  text-transform: capitalize;
`;

const Separator = styled.span`
  color: var(--text-secondary-color);
  font-size: 12px;
  font-weight: 600;
`;

function Shortcut({ keys, title }: { keys: Array<string>; title: string }) {
  return (
    <StyledShortcut>
      <ShortcutLabel>{title}</ShortcutLabel>
      <KeysContainer>
        {keys.map((key, index) => (
          <Fragment key={key}>
            <Key>{key}</Key>
            {index < keys.length - 1 ? <Separator>+</Separator> : null}
          </Fragment>
        ))}
      </KeysContainer>
    </StyledShortcut>
  );
}

const categoryKeyToString: Record<keyof typeof KbdShortcutInformation, string> = {
  general: 'General',
  conversation: 'Conversation',
  view: 'View',
};

const keyboardShortcutData = Object.entries(KbdShortcutInformation).map(([category, shortcuts]) => {
  // TODO: one day typescript will recognise the keys from Object.entries are typed when using a pure typed object and we wont need this as cast
  const title = categoryKeyToString[category as keyof typeof KbdShortcutInformation];

  return (
    <Section key={category}>
      <H2>{title}</H2>
      {shortcuts.map(shortcut => {
        const keys = [];
        if (shortcut.withCtrl) {
          keys.push(ctrlKeyName);
        }
        if (shortcut.withAlt) {
          keys.push('alt');
        }
        if (shortcut.withShift) {
          keys.push('shift');
        }

        return (
          <Shortcut key={shortcut.name} title={shortcut.name} keys={[...keys, ...shortcut.keys]} />
        );
      })}
    </Section>
  );
});

export function KeyboardShortcutsModalContent() {
  return <Container>{keyboardShortcutData}</Container>;
}

const StyledContent = styled(Flex)`
  padding-inline: var(--margins-sm);

  h2 {
    font-size: var(--font-size-xl);
  }

  h2,
  h3 {
    margin: var(--margins-md) 0;
    padding: 0;
  }

  p,
  i {
    line-height: 1.4;
    margin: 0;
    padding: 0;
    text-align: start;
  }
`;

export function KeyboardShortcutsModal() {
  const dispatch = getAppDispatch();

  const onClose = () => {
    dispatch(updateKeyboardShortcutsMenuModal(null));
  };

  return (
    <SessionWrapperModal
      modalId="keyboardShortcutsModal"
      headerChildren={<ModalBasicHeader title="Keyboard Shortcuts" showExitIcon={true} />}
      topAnchor="5vh"
      onClose={onClose}
      $contentMaxWidth={WrapperModalWidth.debug}
      shouldOverflow={true}
      allowOutsideClick={false}
    >
      <StyledContent
        dir="ltr"
        $container={true}
        $flexDirection="column"
        $alignItems="flex-start"
        $padding="var(--margins-sm) 0 var(--margins-xl)"
        width="100%"
      >
        <KeyboardShortcutsModalContent />
      </StyledContent>
    </SessionWrapperModal>
  );
}
