import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarketCryptoTableComponent } from './market-crypto-table.component';

describe('MarketCryptoTableComponent', () => {
  let fixture: ComponentFixture<MarketCryptoTableComponent>;
  let component: MarketCryptoTableComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketCryptoTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketCryptoTableComponent);
    component = fixture.componentInstance;
    component.cryptos = [];
    component.favorites = new Set();
    component.colSort = { col: 'marketCap', dir: 'desc' };
    component.activePeriod = '24h';
    component.showTop200 = false;
    component.activeNetwork = 'all';
    fixture.detectChanges();
  });

  it('should create', () => { expect(component).toBeTruthy(); });
});
