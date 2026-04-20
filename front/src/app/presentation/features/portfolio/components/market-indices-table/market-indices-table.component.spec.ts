import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarketIndicesTableComponent } from './market-indices-table.component';

describe('MarketIndicesTableComponent', () => {
  let fixture: ComponentFixture<MarketIndicesTableComponent>;
  let component: MarketIndicesTableComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketIndicesTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketIndicesTableComponent);
    component = fixture.componentInstance;
    component.indices = [];
    component.favorites = new Set();
    fixture.detectChanges();
  });

  it('should create', () => { expect(component).toBeTruthy(); });
});
