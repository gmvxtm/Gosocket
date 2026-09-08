export class ApplicationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'ApplicationError';
    this.statusCode = statusCode;
  }
}
