export type AccountType = 'Individual' | 'Joint' | 'NRI' | 'Minor';
export type KycStatus = 'KYC Verified' | 'KYC Pending' | 'KYC Failed';
export type InvestorRiskProfile = 'Conservative' | 'Moderate' | 'Aggressive';

export interface InvestorDetails {
  investorName: string;
  mobileNumber: string;
  email: string;
  pan: string;
  dateOfBirth: string;
  accountType: AccountType;
  kycStatus: KycStatus;
  riskProfile: InvestorRiskProfile;
  bankAccount: string;
  nominee: string;
}
