import { assign, cloneDeep } from 'lodash';
import { MessageModel } from './message';
import type { MessageAttributes } from './messageType';

export type ModelAttributes = Record<string, any> & { id: string };

export abstract class Model<T extends ModelAttributes> {
  protected _attributes: T;

  constructor(attributes: T) {
    this._attributes = attributes;
  }

  get id(): string {
    return this._attributes.id;
  }

  public get<K extends keyof T>(key: K): T[K] {
    return this._attributes[key];
  }

  public setKey<K extends keyof T>(key: K, value: T[K] | undefined) {
    const toSet: Partial<T> = {};
    toSet[key] = value;
    this.set(toSet);
    return this;
  }

  public set(attrs: Partial<T>) {
    this._attributes = assign(this._attributes, attrs);
    return this;
  }

  get attributes(): Readonly<T> {
    return this._attributes;
  }

  public cloneAttributes() {
    return cloneDeep(this._attributes);
  }
}

export function makeMessageModels(modelsOrAttrs: Array<MessageAttributes>) {
  return modelsOrAttrs.map(a => new MessageModel(a));
}
