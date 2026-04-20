import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarketAssetCellComponent } from './market-asset-cell.component';

describe('MarketAssetCellComponent', () => {
  let fixture: ComponentFixture<MarketAssetCellComponent>;
  let component: MarketAssetCellComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketAssetCellComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketAssetCellComponent);
    component = fixture.componentInstance;
    component.symbol = 'BTC';
    fixture.detectChanges();
  });

  it('should create', () => { expect(component).toBeTruthy(); });

  it('should render symbol', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="asset-symbol"]' )).toBeTruthy();
  });
});
