import { bindActionCreators, Dispatch } from '@reduxjs/toolkit';

import { actions as conversations } from './ducks/conversations';
import { groupInfoActions } from './ducks/metaGroups';
import { actions as modalDialog } from './ducks/modalDialog';
import { actions as primaryColor } from './ducks/primaryColor';
import { searchActions as search } from './ducks/search';
import { sectionActions as sections } from './ducks/section';
import { userActions as user } from './ducks/user';

export function mapDispatchToProps(dispatch: Dispatch): object {
  return {
    ...bindActionCreators(
      {
        ...search,
        ...conversations,
        ...user,
        ...sections,
        ...modalDialog,
        ...primaryColor,
        ...groupInfoActions,
      },
      dispatch
    ),
  };
}
