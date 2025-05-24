import { Response } from 'node-fetch';

export class EmptySwarmError extends Error {
  public error: any;
  public pubkey: string;
  constructor(pubkey: string, message: string) {
    // 'Error' breaks prototype chain here
    super(message);
    this.pubkey = pubkey.split('.')[0];
    this.name = 'EmptySwarmError';

    // restore prototype chain
    const actualProto = new.target.prototype;

    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    }
    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }
  }
}

export class NotFoundError extends Error {
  public error: any;
  constructor(message: string, error?: any) {
    // 'Error' breaks prototype chain here
    super(message);
    this.error = error;
    this.name = 'NotFoundError';

    // restore prototype chain
    const actualProto = new.target.prototype;

    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    }
    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }
  }
}

export class HTTPError extends Error {
  public response: Response;
  constructor(message: string, response: Response) {
    // 'Error' breaks prototype chain here
    super(`${response.status} Error: ${message}`);
    this.response = response;
    this.name = 'HTTPError';

    // restore prototype chain
    const actualProto = new.target.prototype;

    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    }
    // Maintains proper stack trace, where our error was thrown (only available on V8)
    //   via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this);
    }
  }
}

/**
 * Base error class for all errors in the session module.
 *
 * @note if you make a custom error with a custom message, make sure to restore the prototype chain again using the new class prototype.
 */
class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // NOTE Restores prototype chain. Make sure to reference the new class prototype!
    Object.setPrototypeOf(this, BaseError.prototype);
  }
}

// NOTE If you make a custom error with a custom message, make sure to restore the prototype chain again using the new class prototype.
// OTHERWISE instanceof CHECKS WILL BE FALSE
export class SigningFailed extends BaseError {}
export class InvalidSigningType extends BaseError {}
export class GroupV2SigningFailed extends SigningFailed {}
export class PreConditionFailed extends BaseError {}
export class DecryptionFailed extends BaseError {}
export class InvalidMessage extends BaseError {}
export class SnodeResponseError extends BaseError {
  constructor(message = 'sessionRpc could not talk to node') {
    super(message);
    Object.setPrototypeOf(this, SnodeResponseError.prototype);
  }
}
export class RetrieveDisplayNameError extends BaseError {
  constructor(message = 'failed to retrieve display name after setting it') {
    super(message);
    Object.setPrototypeOf(this, RetrieveDisplayNameError.prototype);
  }
}
export class EmptyDisplayNameError extends BaseError {
  constructor(message = 'display name is empty') {
    super(message);
    Object.setPrototypeOf(this, EmptyDisplayNameError.prototype);
  }
}
export class OnionPathEmptyError extends BaseError {
  constructor(message = 'onion path is empty') {
    super(message);
    Object.setPrototypeOf(this, OnionPathEmptyError.prototype);
  }
}
