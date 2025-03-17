import { cloneDeep, merge } from 'lodash';

export type FakeBackboneAttributes = Record<string, any> & { id: string };

export abstract class FakeBackboneModel<T extends FakeBackboneAttributes> {
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

  public setSingle<K extends keyof T>(key: K, value: T[K]) {
    this.attributes[key] = value;
    return this;
  }

  public set(attrs: Partial<T>) {
    this.attributes = merge(this.attributes, attrs);
    return this;
  }

  public cloneAttributes() {
    return cloneDeep(this.attributes);
  }
}

export class FakeBackboneCollection<
  A extends FakeBackboneAttributes,
  T extends FakeBackboneModel<A>,
> {
  public models: Array<T>;

  constructor(modelsOrAttrs: Array<T | A>, ModelClass: new (attrs: A) => T) {
    this.models = modelsOrAttrs.map(m => {
      if (m instanceof FakeBackboneModel) {
        return m;
      }
      return new ModelClass(m);
    });
  }

  get length() {
    return this.models.length;
  }

  public map(action: (msg: T) => any) {
    return this.models.map(action);
  }

  public at(index: number) {
    return this.models.at(index);
  }

  public find(...args: Parameters<typeof this.models.find>) {
    return this.models.find(...args);
  }

  public forEach(...args: Parameters<typeof this.models.forEach>) {
    return this.models.forEach(...args);
  }

  public filter(...args: Parameters<typeof this.models.filter>) {
    return this.models.filter(...args);
  }
}
