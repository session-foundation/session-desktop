import { SessionWrapperModal, WrapperModalWidth } from '../../../SessionWrapperModal';

export function UserSettingsModalContainer({
  children,
  headerChildren,
  buttonChildren,
  onClose,
  centerAlign,
}: {
  children: React.ReactNode;
  headerChildren: React.ReactNode;
  buttonChildren?: React.ReactNode;
  onClose?: () => void;
  centerAlign?: boolean;
}) {
  return (
    <SessionWrapperModal
      modalId="userSettingsModal"
      headerChildren={headerChildren}
      onClose={onClose || undefined}
      shouldOverflow={true}
      allowOutsideClick={false}
      $contentMinWidth={WrapperModalWidth.normal}
      topAnchor={!centerAlign ? '5vh' : undefined}
      buttonChildren={buttonChildren}
    >
      {children}
    </SessionWrapperModal>
  );
}
