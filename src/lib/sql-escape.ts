/**
 * Escapes SQL LIKE/ILIKE wildcard characters in a user-provided string.
 *
 * PostgreSQL wildcards:
 *   %  — matches any sequence of characters
 *   _  — matches any single character
 *   \  — escape character (must also be escaped when using ESCAPE clause)
 *
 * We escape all three with a backslash so the search performs a literal match.
 *
 * @param input Raw user input
 * @returns Escaped string safe for use in ilike() / similarity()
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, "\\$&");
}
