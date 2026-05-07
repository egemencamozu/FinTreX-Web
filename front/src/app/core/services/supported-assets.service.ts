import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, catchError, of } from 'rxjs';
import { BistSymbol, CryptoSymbol, PreciousMetalSymbol } from '../models/supported-asset.model';

@Injectable({ providedIn: 'root' })
export class SupportedAssetsService {
  private readonly http = inject(HttpClient);

  private bistSymbols$: Observable<BistSymbol[]> | null = null;
  private cryptoSymbols$: Observable<CryptoSymbol[]> | null = null;
  private preciousMetalSymbols$: Observable<PreciousMetalSymbol[]> | null = null;

  getBistSymbols(): Observable<BistSymbol[]> {
    if (!this.bistSymbols$) {
      this.bistSymbols$ = this.http
        .get<BistSymbol[]>('/v1/stocks/symbols')
        .pipe(
          catchError(() => of<BistSymbol[]>([])),
          shareReplay(1)
        );
    }
    return this.bistSymbols$;
  }

  getCryptoSymbols(): Observable<CryptoSymbol[]> {
    if (!this.cryptoSymbols$) {
      this.cryptoSymbols$ = this.http
        .get<CryptoSymbol[]>('/v1/crypto/symbols')
        .pipe(
          catchError(() => of<CryptoSymbol[]>([])),
          shareReplay(1)
        );
    }
    return this.cryptoSymbols$;
  }

  getPreciousMetalSymbols(): Observable<PreciousMetalSymbol[]> {
    if (!this.preciousMetalSymbols$) {
      this.preciousMetalSymbols$ = this.http
        .get<PreciousMetalSymbol[]>('/v1/metals/symbols')
        .pipe(
          catchError(() => of<PreciousMetalSymbol[]>([])),
          shareReplay(1)
        );
    }
    return this.preciousMetalSymbols$;
  }
}
