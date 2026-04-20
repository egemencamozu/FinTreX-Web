import { Injectable } from '@angular/core';
import { MarketCryptoPrice } from '../../../../core/models/market-data.model';

const AVATAR_PALETTE: readonly string[] = [
  '#F7931A', '#627EEA', '#26A17B', '#E84142',
  '#00C087', '#1652F0', '#FF007A', '#9945FF',
  '#14F195', '#E6007A', '#00B4D8', '#FB8500',
  '#2B4C7E', '#5E548E', '#43AA8B', '#D62828',
];

const COIN_NAME_MAP: Record<string, string> = {
  BTC: 'Bitcoin',       ETH: 'Ethereum',      BNB: 'BNB',
  USDT: 'Tether',       XRP: 'XRP',           SOL: 'Solana',
  ADA: 'Cardano',       DOGE: 'Dogecoin',      TRX: 'TRON',
  TON: 'Toncoin',       AVAX: 'Avalanche',     SHIB: 'Shiba Inu',
  LINK: 'Chainlink',    DOT: 'Polkadot',       MATIC: 'Polygon',
  LTC: 'Litecoin',      BCH: 'Bitcoin Cash',   ATOM: 'Cosmos',
  UNI: 'Uniswap',       XLM: 'Stellar',        ETC: 'Ethereum Classic',
  NEAR: 'NEAR Protocol', APT: 'Aptos',         ICP: 'Internet Computer',
  FIL: 'Filecoin',      ARB: 'Arbitrum',       OP: 'Optimism',
  VET: 'VeChain',       ALGO: 'Algorand',      AAVE: 'Aave',
  MKR: 'Maker',         GRT: 'The Graph',      SAND: 'The Sandbox',
  MANA: 'Decentraland', CRV: 'Curve DAO',      BAT: 'Basic Attention',
  SUI: 'Sui',           PEPE: 'Pepe',          WIF: 'dogwifhat',
  BONK: 'Bonk',         JTO: 'Jito',           PYTH: 'Pyth Network',
  TAO: 'Bittensor',     INJ: 'Injective',      SEI: 'Sei',
  TIA: 'Celestia',      ORDI: 'ORDI',          USDC: 'USD Coin',
  DAI: 'Dai',           ZEC: 'Zcash',          XMR: 'Monero',
  USD1: 'USD1',         BUSD: 'Binance USD',
};

const NETWORK_MAP: Record<string, string> = {
  BTC: 'Bitcoin',     ETH: 'Ethereum',    BNB: 'BNB Chain',
  SOL: 'Solana',      ADA: 'Cardano',     XRP: 'XRP Ledger',
  DOGE: 'Dogecoin',   TRX: 'TRON',        TON: 'TON',
  AVAX: 'Avalanche',  MATIC: 'Polygon',   LINK: 'Ethereum',
  UNI: 'Ethereum',    AAVE: 'Ethereum',   MKR: 'Ethereum',
  ATOM: 'Cosmos',     DOT: 'Polkadot',    LTC: 'Litecoin',
  ZEC: 'Zcash',       XMR: 'Monero',      XLM: 'Stellar',
  VET: 'VeChain',     FIL: 'Filecoin',    ETC: 'ETH Classic',
  ALGO: 'Algorand',   ICP: 'ICP',         NEAR: 'NEAR',
  FTM: 'Fantom',      SAND: 'Ethereum',   MANA: 'Ethereum',
  CRV: 'Ethereum',    GRT: 'Ethereum',    BAT: 'Ethereum',
  SUI: 'Sui',         APT: 'Aptos',       ARB: 'Arbitrum',
  OP: 'Optimism',     PEPE: 'Ethereum',   SHIB: 'Ethereum',
  WIF: 'Solana',      BONK: 'Solana',     JTO: 'Solana',
  PYTH: 'Solana',     TAO: 'Bittensor',   INJ: 'Injective',
  SEI: 'Sei',         TIA: 'Celestia',    ORDI: 'Bitcoin',
  USDT: 'Multi-chain', USDC: 'Multi-chain', DAI: 'Ethereum',
  USD1: 'Multi-chain', BUSD: 'BNB Chain',
};

const NETWORK_CLASS_MAP: Record<string, string> = {
  'Ethereum':    'net-eth',
  'Solana':      'net-sol',
  'BNB Chain':   'net-bnb',
  'Bitcoin':     'net-btc',
  'Polygon':     'net-matic',
  'Avalanche':   'net-avax',
  'TRON':        'net-trx',
  'TON':         'net-ton',
  'Arbitrum':    'net-arb',
  'Optimism':    'net-op',
  'Multi-chain': 'net-multi',
};

@Injectable({ providedIn: 'root' })
export class MarketUiService {
  getCoinFullName(baseAsset: string): string {
    return COIN_NAME_MAP[(baseAsset ?? '').toUpperCase()] ?? baseAsset;
  }

  getCryptoLogoUrl(baseAsset: string): string {
    const s = (baseAsset ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${s}.svg`;
  }

  getAvatarLetter(symbol: string): string {
    const clean = (symbol ?? '').replace(/[^A-Za-z0-9]/g, '');
    return (clean[0] ?? '?').toUpperCase();
  }

  getAvatarColor(symbol: string): string {
    let h = 0;
    for (let i = 0; i < symbol.length; i++) {
      h = (h + symbol.charCodeAt(i)) % AVATAR_PALETTE.length;
    }
    return AVATAR_PALETTE[h];
  }

  getNetwork(item: Pick<MarketCryptoPrice, 'baseAsset' | 'network'>): string {
    const fromApi = (item.network ?? '').trim();
    if (fromApi.length > 0) return fromApi;
    return NETWORK_MAP[(item.baseAsset ?? '').toUpperCase()] ?? '—';
  }

  getNetworkClass(item: Pick<MarketCryptoPrice, 'baseAsset' | 'network'>): string {
    const net = this.getNetwork(item);
    return NETWORK_CLASS_MAP[net] ?? 'net-default';
  }

  deltaClass(value: number): string {
    if (value > 0) return 'mk__up';
    if (value < 0) return 'mk__down';
    return 'mk__flat';
  }

  onCoinLogoLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    const parent = img.closest('.mk__avatar') as HTMLElement | null;
    if (parent) {
      parent.style.background = 'var(--bg-surface, #fff)';
      parent.style.border = '1px solid var(--border-subtle, #e5e7eb)';
      img.style.opacity = '1';
    }
  }

  onCoinLogoError(event: Event): void {
    (event.target as HTMLElement).remove();
  }
}
