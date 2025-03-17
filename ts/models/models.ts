import { assign, cloneDeep } from 'lodash';
import { MessageModel } from './message';
import type { MessageAttributes } from './messageType';

export type ModelAttributes = Record<string, any> & { id: string };

export abstract class Model<T extends ModelAttributes> {
  protected attributes: T;

  constructor(attributes: T) {
    this.attributes = attributes;
  }

  get id(): string {
    return this.attributes.id;
  }

  public get<K extends keyof T>(key: K): T[K] {
    return this.attributes[key];
  }

  public setSingle<K extends keyof T>(key: K, value: T[K] | undefined) {
    const toSet: Partial<T> = {};
    toSet[key] = value;
    this.set(toSet);
    return this;
  }

  public set(attrs: Partial<T>) {
    this.attributes = assign(this.attributes, attrs);
    return this;
  }

  public cloneAttributes() {
    return cloneDeep(this.attributes);
  }
}

export function makeMessageModels(modelsOrAttrs: Array<MessageModel | MessageAttributes>) {
  return modelsOrAttrs.map(a => (a instanceof MessageModel ? a : new MessageModel(a)));
}
