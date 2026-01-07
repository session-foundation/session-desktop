/**
 *
 * Warning: You shouldn't need to use this symbol directly.
 *
 * We want the .set() and .setKey() to be inaccessible from the outside,
 * except for some "friends" classes of the Model class.
 * Here, friends means cpp classes friends.
 * To break some of the huge models, we have to expose the set/setKey methods to some related classes,
 * like the `SessionProfileChanges`.
 *
 * We still do not want to expose the set/setKey methods directly for every other usecase though.
 *
 * The way this works is that we have a `privateSet` and `privateSetKey` symbols.
 * Those are linked as a method of the Model class.
 * If a ts class wants to become a friend of the Model class to call those directly, it can do so by importing the symbols from this file.
 *
 * This way, those symbols are not accessible from the outside, and won't show up when we CTRL-TAB on a `conversation.`, but they are accessible if you import them from this file.
 *
 * This is not amazing, but this is our only option currently.
 */
export const privateSet = Symbol('set');

/**
 * Warning: You shouldn't need to use this symbol directly.
 * See the comment in this file for more info.
 */
export const privateSetKey = Symbol('setKey');
