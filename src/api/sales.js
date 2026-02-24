export async function createSale(sale) {
  // Stubbed API call: replace with real backend endpoint
  // Intentionally resolves after short delay to simulate network
  // Throw to simulate failures when needed
  return new Promise((resolve) => {
    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log('Sale synced', sale);
      resolve({ ok: true, id: String(Date.now()) });
    }, 200);
  });
}
