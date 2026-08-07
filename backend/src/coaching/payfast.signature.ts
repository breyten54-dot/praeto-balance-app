import { createHash } from 'crypto';

/**
 * RFC 1738 URL encoding as required by PayFast:
 * - spaces become '+'
 * - other special characters are percent-encoded (uppercase hex)
 */
export function rfc1738Encode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

/**
 * Build the PayFast signature string and return its lowercase hex MD5 digest.
 *
 * - Empty fields are skipped.
 * - Fields are processed in insertion order of the `fields` object.
 * - If a passphrase is provided, it is appended as `passphrase=<encoded>`.
 */
export function generatePayfastSignature(
  fields: Record<string, string>,
  passphrase?: string,
): string {
  const pairs: string[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value === '') continue;
    pairs.push(`${key}=${rfc1738Encode(value)}`);
  }

  let payload = pairs.join('&');

  if (passphrase && passphrase !== '') {
    payload += `&passphrase=${rfc1738Encode(passphrase)}`;
  }

  return createHash('md5').update(payload).digest('hex');
}
