export class EmailNotConfirmedError extends Error {
  constructor(
    readonly email: string,
    message: string,
  ) {
    super(message);
    this.name = 'EmailNotConfirmedError';
  }
}
