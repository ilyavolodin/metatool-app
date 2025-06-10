import { describe, expect, it } from 'vitest';
import { enumToPgEnum } from './enum-to-pg-enum';

enum Example {
  A = 'A',
  B = 'B',
}

enum Numbers {
  ONE = 1,
  TWO = 2,
}

describe('enumToPgEnum', () => {
  it('converts an enum to array of strings', () => {
    const result = enumToPgEnum(Example);
    expect(result).toEqual(['A', 'B']);
  });

  it('handles numeric enums', () => {
    const result = enumToPgEnum(Numbers);
    expect(result).toEqual(['ONE', 'TWO', '1', '2']);
  });
});
