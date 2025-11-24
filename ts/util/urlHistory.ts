import { z } from 'zod';
import { SettingsKey } from '../data/settings-key';
import { Storage } from './storage';
import { tr } from '../localization/localeTools';

// NOTE: we currently only want to use url interactions for official urls. Once we have the ability to "trust" a url this can change
function isValidUrl(url: string): boolean {
  if (!URL.canParse(url)) {
    return false;
  }

  const host = new URL(url).host;
  return (
    host === 'getsession.org' ||
    host === 'session.foundation' ||
    host === 'token.getsession.org' ||
    host === 'stake.getsession.org'
  );
}

export enum URLInteraction {
  OPEN = 1,
  COPY = 2,
  TRUST = 3,
}

const UrlInteractionSchema = z.object({
  url: z.string(),
  lastUpdated: z.number(),
  interactions: z.array(z.nativeEnum(URLInteraction)),
});

const UrlInteractionsSchema = z.array(UrlInteractionSchema);

export type UrlInteractionsType = z.infer<typeof UrlInteractionsSchema>;

export function getUrlInteractions() {
  let interactions: UrlInteractionsType = [];
  const rawInteractions = Storage.get(SettingsKey.urlInteractions);
  const result = UrlInteractionsSchema.safeParse(rawInteractions);
  if (result.error) {
    window?.log?.error(`failed to parse ${SettingsKey.urlInteractions}`, result.error);
  } else {
    interactions = result.data;
  }
  return interactions;
}

export async function registerUrlInteraction(url: string, interaction: URLInteraction) {
  if (!isValidUrl(url)) {
    return;
  }

  const interactions = getUrlInteractions();
  const idx = interactions.findIndex(item => item.url === url);
  if (idx !== -1) {
    if (!interactions[idx].interactions.includes(interaction)) {
      interactions[idx].interactions.push(interaction);
    }
  } else {
    interactions.push({
      interactions: [interaction],
      url,
      lastUpdated: Date.now(),
    });
  }

  await Storage.put(SettingsKey.urlInteractions, interactions);
}

export function getUrlInteractionsForUrl(url: string): Array<URLInteraction> {
  if (!isValidUrl(url)) {
    return [];
  }

  const interactions = getUrlInteractions();
  return interactions.find(item => item.url === url)?.interactions ?? [];
}

export async function clearAllUrlInteractions() {
  await Storage.put(SettingsKey.urlInteractions, []);
}

export async function removeUrlInteractionHistory(url: string) {
  const interactions = getUrlInteractions();
  const idx = interactions.findIndex(item => item.url === url);
  if (idx !== -1) {
    interactions.splice(idx);
  }

  await Storage.put(SettingsKey.urlInteractions, interactions);
}

export function urlInteractionToString(interaction: URLInteraction) {
  switch (interaction) {
    case URLInteraction.OPEN:
      return tr('open');
    case URLInteraction.COPY:
      return tr('copy');
    case URLInteraction.TRUST:
      // TODO: use localized string once it exists
      return 'Trust';
    default:
      return tr('unknown');
  }
}
