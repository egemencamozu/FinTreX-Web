export abstract class PortfolioRepository {
  abstract getByUserId(userId: string): void;
  abstract create(name: string): void;
  abstract delete(portfolioId: string): void;
}
