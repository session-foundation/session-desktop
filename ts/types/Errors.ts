function withClause(error: unknown) {
  if (error && typeof error === 'object' && 'cause' in error) {
    return `\nCaused by: ${String(error.cause)}`;
  }
  return '';
}

function toString(error: unknown): string {
  if (error instanceof Error && error.stack) {
    return error.stack + withClause(error);
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message) + withClause(error);
  }
  return String(error) + withClause(error);
}

export const Errors = {
  toString,
};
