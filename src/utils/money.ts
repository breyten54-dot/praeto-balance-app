export function formatRand(cents: number): string {
  const rand = cents / 100;
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: rand % 1 === 0 ? 0 : 2,
  }).format(rand);
}
