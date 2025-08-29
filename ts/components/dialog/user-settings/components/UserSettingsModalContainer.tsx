import { SessionWrapperModal, WrapperModalWidth } from '../../../SessionWrapperModal';

export function UserSettingsModalContainer({
  children,
  headerChildren,
  buttonChildren,
  onClose,
}: {
  children: React.ReactNode;
  headerChildren: React.ReactNode;
  buttonChildren?: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <SessionWrapperModal
      headerChildren={headerChildren}
      onClose={onClose || undefined}
      shouldOverflow={true}
      allowOutsideClick={false}
      $contentMinWidth={WrapperModalWidth.normal}
      topAnchor="5vh"
      buttonChildren={buttonChildren}
    >
      {children}
    </SessionWrapperModal>
  );
}
