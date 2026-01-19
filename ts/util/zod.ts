/** NOTE: We need to globally configure zod before it is used to define any
 * schemas and the only way to ensure `z.config` is called before zod is used
 * every time is make this utility file the only place zod can be directly
 * imported from, and have all uses of zod be via a re-exported version from
 * this file.
 */
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- This is the only place we want to import zod directly
import { z } from 'zod';
// NOTE: we explicity load the en locale as we want to remove all of the other locales from the bundle
import { en } from 'zod/locales'
import { isDebugMode } from '../shared/env_vars';

z.config({
  // NOTE: we need to use zod in a jitless configuration otherwise it violates our CSP
  jitless: true,
  localeError: en().localeError,
});

const safeParseOptions = {
  reportInput: isDebugMode(),
} satisfies Parameters<z.ZodType['safeParse']>[1];

export function zodSafeParse<T>(schema: z.ZodType<T>, data: unknown): z.ZodSafeParseResult<T> {
  return schema.safeParse(data, safeParseOptions);
}

export default z;
