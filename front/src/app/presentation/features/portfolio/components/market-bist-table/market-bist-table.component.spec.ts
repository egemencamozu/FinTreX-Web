import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarketBistTableComponent } from './market-bist-table.component';

describe('MarketBistTableComponent', () => {
  let fixture: ComponentFixture<MarketBistTableComponent>;
  let component: MarketBistTableComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketBistTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketBistTableComponent);
    component = fixture.componentInstance;
    component.stocks = [];
    component.favorites = new Set();
    fixture.detectChanges();
  });

  it('should create', () => { expect(component).toBeTruthy(); });
});
