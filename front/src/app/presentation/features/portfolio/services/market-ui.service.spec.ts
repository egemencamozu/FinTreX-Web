import { MarketUiService } from './market-ui.service';

describe('MarketUiService', () => {
  let service: MarketUiService;

  beforeEach(() => { service = new MarketUiService(); });

  it('should create', () => { expect(service).toBeTruthy(); });

  it('should return coin full name for known symbol', () => {
    expect(service.getCoinFullName('BTC')).toBe('Bitcoin');
  });

  it('should return symbol itself for unknown coin', () => {
    expect(service.getCoinFullName('XYZ')).toBe('XYZ');
  });

  it('should return mk__up for positive delta', () => {
    expect(service.deltaClass(1.5)).toBe('mk__up');
  });

  it('should return mk__down for negative delta', () => {
    expect(service.deltaClass(-1.5)).toBe('mk__down');
  });

  it('should return mk__flat for zero delta', () => {
    expect(service.deltaClass(0)).toBe('mk__flat');
  });
});
