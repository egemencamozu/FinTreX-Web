import { MarketChangePipe } from './market-change.pipe';

describe('MarketChangePipe', () => {
  let pipe: MarketChangePipe;

  beforeEach(() => { pipe = new MarketChangePipe(); });

  it('should create', () => { expect(pipe).toBeTruthy(); });

  it('should show dash for zero', () => {
    expect(pipe.transform(0)).toBe('— 0.00%');
  });

  it('should show up arrow for positive', () => {
    expect(pipe.transform(1.5)).toBe('▲ 1.50%');
  });

  it('should show down arrow for negative', () => {
    expect(pipe.transform(-2.3)).toBe('▼ 2.30%');
  });
});
