// Custom error classes for COSE-HPKE operations

export class CoseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoseError';
  }
}

export class InvalidKeyError extends CoseError {
  constructor(message: string, public readonly keyType?: string) {
    super(message);
    this.name = 'InvalidKeyError';
  }
}

export class DecryptionError extends CoseError {
  constructor(message: string, public readonly reason?: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}
