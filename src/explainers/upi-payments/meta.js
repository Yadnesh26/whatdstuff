export default {
  id: 'upi-payments',
  title: 'How a UPI Payment Works',
  summary:
    'You scan, you tap, the shop\'s phone chimes — and no money moves. Nothing leaves your bank and nothing enters theirs: two banks edit their own private books because one machine in the middle told them to, sealed by a PIN the app you tapped is not allowed to read. The actual cash follows hours later, netted down, ten times a day.',
  accent: '#2fd07a',
  // one-line teardown for the library card
  spec: 'Hub and spoke · ReqValAdd, then debit, then credit · netted and settled 10× a day',
  // part names, so search finds this machine by what is inside it
  keywords:
    'upi npci unified payments interface vpa virtual payment address handle psp tpap sponsor bank remitter beneficiary reqpay reqvaladd upi pin common library hsm device binding switch deferred net settlement rbi qr code gpay phonepe paytm imps ifsc',
  categories: ['communications', 'electronics'],
};
