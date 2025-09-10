import { assign, cloneDeep } from 'lodash';

export type ModelAttributes = Record<string, any> & { id: string };

export abstract class Model<T extends ModelAttributes> {
  private _attributes: T;

  constructor(attributes: T) {
    this._attributes = attributes;
  }

  get id(): string {
    return this._attributes.id;
  }

  public get<K extends keyof T>(key: K): T[K] {
    return this._attributes[key];
  }

  protected setKey<K extends keyof T>(key: K, value: T[K] | undefined) {
    const toSet: Partial<T> = {};
    toSet[key] = value;
    this.set(toSet);
    return this;
  }

  protected set(attrs: Partial<T>) {
    this._attributes = assign(this._attributes, attrs);
    return this;
  }

  get attributes(): Readonly<T> {
    return this._attributes;
  }

  public setId(newId: string) {
    if (!this.id) {
      this._attributes.id = newId;
    }
  }

  public cloneAttributes() {
    return cloneDeep(this._attributes);
  }
}
