export abstract class PaymentService {
  abstract processUpgrade(userId: string, tier: string): void;
  abstract cancelSubscription(subscriptionId: string): void;
  abstract updatePaymentMethod(userId: string): void;
}
