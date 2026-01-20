import z, { zodSafeParse } from './zod';
import { SettingsKey } from '../data/settings-key';
import { Storage } from './storage';
import { tr } from '../localization/localeTools';
import { CTAVariant, isCTAVariant } from '../components/dialog/cta/types';

export enum CTAInteraction {
  OPEN = 'open',
  ACTION = 'action',
  CANCEL = 'cancel',
  CLOSE = 'close',
}

const CtaInteractionSchema = z.object({
  variant: z.enum(CTAVariant),
  lastUpdated: z.number(),
  open: z.number().optional(),
  action: z.number().optional(),
  cancel: z.number().optional(),
  close: z.number().optional(),
});

const CtaInteractionsSchema = z.array(CtaInteractionSchema);

export type CtaInteractionType = z.infer<typeof CtaInteractionSchema>;
export type CtaInteractionsType = z.infer<typeof CtaInteractionsSchema>;

export function getCtaInteractions() {
  let interactions: CtaInteractionsType = [];
  const rawInteractions = Storage.get(SettingsKey.ctaInteractions) ?? [];
  const result = zodSafeParse(CtaInteractionsSchema, rawInteractions);
  if (result.error) {
    window?.log?.error(`failed to parse ${SettingsKey.ctaInteractions}`, result.error);
  } else {
    interactions = result.data;
  }
  return interactions;
}

export async function registerCtaInteraction(variant: CTAVariant, interaction: CTAInteraction) {
  if (!isCTAVariant(variant)) {
    return;
  }

  const interactions = getCtaInteractions();
  const idx = interactions.findIndex(item => item.variant === variant);
  if (idx !== -1) {
    interactions[idx][interaction] = (interactions[idx][interaction] ?? 0) + 1;
  } else {
    interactions.push({
      [interaction]: 1,
      variant,
      lastUpdated: Date.now(),
    });
  }

  await Storage.put(SettingsKey.ctaInteractions, interactions);
}

export function getCtaInteractionsForCta(variant: CTAVariant): CtaInteractionType | undefined {
  if (!isCTAVariant(variant)) {
    return undefined;
  }

  const interactions = getCtaInteractions();
  return interactions.find(item => item.variant === variant);
}

export async function clearAllCtaInteractions() {
  await Storage.put(SettingsKey.ctaInteractions, []);
}

export async function removeCtaInteractionHistory(variant: CTAVariant) {
  const interactions = getCtaInteractions();
  const idx = interactions.findIndex(item => item.variant === variant);
  if (idx !== -1) {
    interactions.splice(idx);
  }

  await Storage.put(SettingsKey.ctaInteractions, interactions);
}

export function ctaInteractionToString(interaction: CTAInteraction) {
  switch (interaction) {
    case CTAInteraction.OPEN:
      return tr('open');
    case CTAInteraction.ACTION:
      // Most "actions" are confirm
      return tr('confirm');
    case CTAInteraction.CANCEL:
      return tr('cancel');
    case CTAInteraction.CLOSE:
      return tr('close');
    default:
      return tr('unknown');
  }
}
