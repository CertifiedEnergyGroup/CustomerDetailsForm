// null means automatic; even an empty manual entry remains a user override.
export class DepositPolicy {
  constructor() { this.reset(); }
  reset() { this.manualValue = null; }
  edit(value) { this.manualValue = value; }
  amount(total, payment) {
    if (payment === 'finance') return '0.00';
    if (this.manualValue !== null) return this.manualValue;
    // 10% rounded to cents, without retaining fractions of a cent.
    return (Math.round((Number(total) || 0) * 10) / 100).toFixed(2);
  }
}
