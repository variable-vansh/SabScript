export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username);
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
