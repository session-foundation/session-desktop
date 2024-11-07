import { Item, ItemProps } from 'react-contexify';

export function ItemWithDataTestId({ children, ...props }: ItemProps) {
  return (
    <Item data-testid="context-menu-item" {...props}>
      {children}
    </Item>
  );
}
