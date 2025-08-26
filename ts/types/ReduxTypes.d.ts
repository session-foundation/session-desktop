/**
 * Note: The types defined in this file have to be self contained.
 * We must not import anything in this file, especially not something relying on the window object (even indirectly, through an import chain).
 *
 * e.g. import type { YourTypeHere } from 'path/to/ReduxTypes';
 */

export type PasswordAction = 'set' | 'change' | 'remove';

export type EditProfilePictureModalProps = {
  conversationId: string;
};
