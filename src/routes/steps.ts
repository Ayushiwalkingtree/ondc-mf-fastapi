export interface JourneyStep {
  index: number;
  title: string;
  subtitle: string;
  navLabel: string;
  path: string;
}

export const journeySteps: JourneyStep[] = [
  {
    index: 0,
    title: 'Client Onboarding',
    subtitle: 'Capture basic investor details before starting MF transaction.',
    navLabel: 'Onboarding',
    path: '/onboarding',
  },
  {
    index: 1,
    title: 'ONDC Catalogue Search',
    subtitle: 'Search MF schemes discovered through ONDC /search and /on_search.',
    navLabel: 'Catalogue',
    path: '/catalogue',
  },
  {
    index: 2,
    title: 'Transaction Setup',
    subtitle: 'Choose purchase/SIP/redemption details and payment mode.',
    navLabel: 'Transaction',
    path: '/transaction-setup',
  },
  {
    index: 3,
    title: 'Review & Confirm',
    subtitle: 'Validate order details before sending ONDC /confirm.',
    navLabel: 'Review',
    path: '/review',
  },
  {
    index: 4,
    title: 'Order Tracking',
    subtitle: 'Track ONDC order status and post-transaction updates.',
    navLabel: 'Tracking',
    path: '/tracking',
  },
];
