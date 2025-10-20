function _extendableBuiltin(cls) {
  function ExtendableBuiltin() {
    var instance = Reflect.construct(cls, Array.from(arguments));
    Object.setPrototypeOf(instance, Object.getPrototypeOf(this));
    return instance;
  }
  ExtendableBuiltin.prototype = Object.create(cls.prototype, {
    constructor: {
      value: cls,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (Object.setPrototypeOf) {
    Object.setPrototypeOf(ExtendableBuiltin, cls);
  } else {
    ExtendableBuiltin.__proto__ = cls;
  }
  return ExtendableBuiltin;
}
export const API_ERROR = 'API_ERROR';
export default class APIError extends _extendableBuiltin(Error) {
  constructor(message, status, api, meta = {}) {
    super(message);
    this.message = message;
    this.status = status;
    this.api = api;
    this.name = API_ERROR;
    this.meta = meta;
  }
}