export enum ExpertiseArea {
  Bist = 'Bist',
  Crypto = 'Crypto',
  PreciousMetal = 'PreciousMetal',
  Forex = 'Forex',
  Commodity = 'Commodity',
  RealEstate = 'RealEstate',
  Bonds = 'Bonds',
  Etf = 'Etf',
}

export const EXPERTISE_AREA_LABELS: Record<ExpertiseArea, string> = {
  [ExpertiseArea.Bist]: 'BIST / Borsa',
  [ExpertiseArea.Crypto]: 'Kripto Para',
  [ExpertiseArea.PreciousMetal]: 'Kıymetli Maden',
  [ExpertiseArea.Forex]: 'Forex / Döviz',
  [ExpertiseArea.Commodity]: 'Emtia',
  [ExpertiseArea.RealEstate]: 'Gayrimenkul',
  [ExpertiseArea.Bonds]: 'Tahvil / Bono',
  [ExpertiseArea.Etf]: 'ETF / Fon',
};
