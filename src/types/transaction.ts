export type TransactionType =
  | 'Lumpsum Purchase'
  | 'SIP Registration'
  | 'Additional Purchase'
  | 'Redemption';

export type PaymentMode = 'UPI' | 'Net Banking' | 'Mandate';
export type FolioMode = 'New Folio' | 'Existing Folio - 1029384';
export type SipFrequency = 'Not Applicable' | 'Monthly' | 'Weekly' | 'Quarterly';
export type DeclarationStatus = 'Terms accepted' | 'Pending';

export interface TransactionDetails {
  transactionType: TransactionType;
  amount: number;
  amountInWords: string;
  paymentMode: PaymentMode;
  folio: FolioMode;
  sipFrequency: SipFrequency;
  startDate: string;
  declaration: DeclarationStatus;
}
