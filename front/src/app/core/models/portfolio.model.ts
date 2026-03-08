import { Asset } from './asset.model';

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  assets: Asset[];
  createdAt: Date;
}
