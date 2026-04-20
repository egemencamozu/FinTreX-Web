import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { MarketDataRepository } from '../../../../../core/interfaces/market-data.repository';
import { MarketSnapshot, MarketStreamEvent } from '../../../../../core/models/market-data.model';

import { Markets } from './markets';

class MarketDataRepositoryStub extends MarketDataRepository {
  getSnapshot(): Observable<MarketSnapshot> {
    return of({
      marketOpen: false,
      stocks: [],
      cryptos: [],
      indices: [],
      usdTry: null,
      goldSpot: null,
      goldTypes: null,
    });
  }

  connect(): Observable<MarketStreamEvent> {
    return of({ type: 'connection', state: 'connected' });
  }

  subscribeToStocks(_: string[]): Promise<void> {
    return Promise.resolve();
  }

  subscribeToCryptos(_: string[]): Promise<void> {
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }
}

describe('Markets', () => {
  let component: Markets;
  let fixture: ComponentFixture<Markets>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Markets],
      providers: [{ provide: MarketDataRepository, useClass: MarketDataRepositoryStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(Markets);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
