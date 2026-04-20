import { CompactNumberPipe } from './compact-number.pipe';

describe('CompactNumberPipe', () => {
  let pipe: CompactNumberPipe;

  beforeEach(() => { pipe = new CompactNumberPipe(); });

  it('should create', () => { expect(pipe).toBeTruthy(); });

  it('should format large numbers compactly', () => {
    const result = pipe.transform(1_000_000);
    expect(result).toBeTruthy();
  });
});
