import { MarketPricePipe } from './market-price.pipe';

describe('MarketPricePipe', () => {
  let pipe: MarketPricePipe;

  beforeEach(() => { pipe = new MarketPricePipe(); });

  it('should create', () => { expect(pipe).toBeTruthy(); });

  it('should format USD price', () => {
    const result = pipe.transform(1234.56, 'USD');
    expect(result).toContain('1.234');
  });

  it('should format TRY price', () => {
    const result = pipe.transform(100, 'TRY');
    expect(result).toBeTruthy();
  });
});
