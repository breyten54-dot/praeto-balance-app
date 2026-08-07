import { generatePayfastSignature, rfc1738Encode } from './payfast.signature';

const FIELDS = {
  merchant_id: '10000100',
  merchant_key: '46f0cd694581a',
  return_url: 'http://localhost:4000/api/v1/payments/coaching-return?bookingId=abc123',
  cancel_url: 'http://localhost:4000/api/v1/payments/coaching-return?bookingId=abc123&status=cancelled',
  notify_url: 'http://localhost:4000/api/v1/webhooks/payfast/itn',
  m_payment_id: 'abc123',
  amount: '1900.00',
  item_name: 'Praeto Balance — Starter',
};

describe('PayFast signature', () => {
  it('golden vector without passphrase', () => {
    expect(generatePayfastSignature(FIELDS)).toBe(
      '8322bde31aef3c56f01106733235362b',
    );
  });

  it('with passphrase appended', () => {
    expect(generatePayfastSignature(FIELDS, 'secret&pass')).toBe(
      '0af2e57b1a933482dbf2be4738d7f3c9',
    );
  });

  it('empty passphrase is ignored', () => {
    expect(generatePayfastSignature(FIELDS, '')).toBe(
      generatePayfastSignature(FIELDS),
    );
  });

  it('RFC1738 encodes spaces as + and & as %26', () => {
    expect(rfc1738Encode('a b')).toBe('a+b');
    expect(rfc1738Encode('a&b')).toBe('a%26b');
  });
});
