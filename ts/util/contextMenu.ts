import { contextMenu, ShowContextMenuParams } from 'react-contexify';

export function closeContextMenus() {
  contextMenu.hideAll();
}

export function showContextMenu<TProps>(params: ShowContextMenuParams<TProps>) {
  contextMenu.show(params);
}
