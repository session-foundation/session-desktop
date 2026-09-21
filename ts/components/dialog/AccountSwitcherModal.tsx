import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';

import { getAppDispatch } from '../../state/dispatch';
import { accountSwitcherModal } from '../../state/ducks/modalDialog';
import { ModalBasicHeader, SessionWrapperModal, WrapperModalWidth } from '../SessionWrapperModal';
import {
  AccountSummary,
  addAccount,
  forgetAccount,
  getAccounts,
  renameAccount,
  setAccountRunInBackground,
  switchToAccount,
} from '../../util/accounts';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { SessionSpinner } from '../loading';
import { ToastUtils } from '../../session/utils';

/**
 * TODO(l10n): not in the session-localization project yet — the strings repo is a separate
 * submodule this fork does not own.
 */
const TITLE = 'Accounts';
const ADD_ACCOUNT = 'Add account';
const EXPLANATION =
  'Every account runs at the same time, each in its own window, so messages and calls arrive for all of them. Selecting one brings its window to the front.';
const CURRENT = 'This window';
const RUNNING_LABEL = 'Keep running in the background';
const FORGET = 'Remove from this list';
const RENAME = 'Rename';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--margins-sm);
  width: 100%;
  padding: var(--margins-sm) 0 var(--margins-md);
`;

const Explanation = styled.p`
  margin: 0 0 var(--margins-xs) 0;
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  line-height: 1.4;
`;

const Row = styled.div<{ $isCurrent: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--margins-sm);
  padding: var(--margins-sm);
  border-radius: var(--border-radius);
  border: 1px solid ${props => (props.$isCurrent ? 'var(--primary-color)' : 'transparent')};
  background-color: var(--background-secondary-color);
  cursor: ${props => (props.$isCurrent ? 'default' : 'pointer')};

  &:hover {
    background-color: var(--background-modifier-hover);
  }
`;

const RowText = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-width: 0;
`;

const Name = styled.span`
  color: var(--text-primary-color);
  font-size: var(--font-size-md);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Sub = styled.span`
  color: var(--text-secondary-color);
  font-size: var(--font-size-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Badge = styled.span`
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background-color: var(--primary-color);
  color: var(--black-color);
  font-size: var(--font-size-xs);
`;

const RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: var(--margins-xs);
  flex-shrink: 0;
`;

const BackgroundToggle = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary-color);
  font-size: var(--font-size-xs);
  cursor: pointer;
  white-space: nowrap;
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: var(--margins-xs);
  padding: 10px;
  border-radius: var(--border-radius);
  border: 1px dashed var(--border-color);
  background-color: transparent;
  color: var(--text-primary-color);
  cursor: pointer;

  &:hover {
    background-color: var(--background-modifier-hover);
  }
`;

function shortSessionId(sessionId: string | null) {
  if (!sessionId) {
    return 'Not signed in yet';
  }
  return `${sessionId.slice(0, 8)}…${sessionId.slice(-6)}`;
}

const AccountRow = ({ account, onChanged }: { account: AccountSummary; onChanged: () => void }) => {
  const toggleBackground = (checked: boolean) => {
    async function run() {
      await setAccountRunInBackground(account.id, checked);
      onChanged();
    }
    void run();
  };

  const rename = () => {
    async function run() {
      // eslint-disable-next-line no-alert
      const next = window.prompt(RENAME, account.displayName || account.label);
      if (next && next.trim()) {
        await renameAccount(account.id, next.trim());
        onChanged();
      }
    }
    void run();
  };

  const forget = () => {
    async function run() {
      const result = await forgetAccount(account.id);
      if (result.removed) {
        ToastUtils.pushToastInfo(
          'accountForgotten',
          `Removed from the list. Its data is still on disk at ${result.dataDir}`
        );
      }
      onChanged();
    }
    void run();
  };

  const select = () => {
    if (account.isCurrent) {
      return;
    }
    void switchToAccount(account.id);
  };

  return (
    <Row
      $isCurrent={account.isCurrent}
      onClick={select}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          select();
        }
      }}
    >
      <RowText>
        <Name>{account.displayName || account.label}</Name>
        <Sub>{shortSessionId(account.sessionId)}</Sub>
      </RowText>

      {account.isCurrent ? <Badge>{CURRENT}</Badge> : null}

      <RowActions onClick={e => e.stopPropagation()}>
        <BackgroundToggle title={RUNNING_LABEL}>
          <input
            type="checkbox"
            checked={account.runInBackground}
            onChange={e => {
              toggleBackground(e.target.checked);
            }}
          />
          Background
        </BackgroundToggle>

        <SessionLucideIconButton
          iconSize="medium"
          unicode={LUCIDE_ICONS_UNICODE.PENCIL}
          title={RENAME}
          ariaLabel={RENAME}
          iconColor="var(--text-secondary-color)"
          onClick={rename}
        />

        {account.isCurrent || account.isDefault ? null : (
          <SessionLucideIconButton
            iconSize="medium"
            unicode={LUCIDE_ICONS_UNICODE.TRASH2}
            title={FORGET}
            ariaLabel={FORGET}
            iconColor="var(--danger-color)"
            onClick={forget}
          />
        )}
      </RowActions>
    </Row>
  );
};

export const AccountSwitcherModal = () => {
  const dispatch = getAppDispatch();
  const [accounts, setAccounts] = useState<Array<AccountSummary> | null>(null);

  const refresh = useCallback(() => {
    async function load() {
      try {
        const result = await getAccounts();
        setAccounts(result.accounts);
      } catch (e) {
        window.log?.warn('AccountSwitcherModal could not list accounts:', e?.message);
        setAccounts([]);
      }
    }
    void load();
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onClose = () => {
    dispatch(accountSwitcherModal(null));
  };

  const onAddAccount = () => {
    async function run() {
      await addAccount();
      refresh();
    }
    void run();
  };

  return (
    <SessionWrapperModal
      modalId="accountSwitcherModal"
      headerChildren={<ModalBasicHeader title={TITLE} showExitIcon={true} />}
      onClose={onClose}
      $contentMaxWidth={WrapperModalWidth.wide}
      shouldOverflow={true}
    >
      <Container>
        <Explanation>{EXPLANATION}</Explanation>
        {accounts === null ? (
          <SessionSpinner $loading={true} />
        ) : (
          accounts.map(account => (
            <AccountRow key={account.id} account={account} onChanged={refresh} />
          ))
        )}
        <AddButton type="button" onClick={onAddAccount}>
          {ADD_ACCOUNT}
        </AddButton>
      </Container>
    </SessionWrapperModal>
  );
};
