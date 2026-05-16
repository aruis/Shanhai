import { describe, expect, it } from 'vitest';
import { directionFromValue } from '../../src/render/flowDirection';

describe('flow direction rendering semantics', () => {
  it('does not render arrows for the no-flow sentinel', () => {
    expect(directionFromValue(-1)).toBeNull();
  });

  it('matches the hydrology direction code order', () => {
    expect(directionFromValue(0)).toMatchObject({ dx: 0, dy: -1 });
    expect(directionFromValue(2)).toMatchObject({ dx: 1, dy: 0 });
    expect(directionFromValue(4)).toMatchObject({ dx: 0, dy: 1 });
    expect(directionFromValue(6)).toMatchObject({ dx: -1, dy: 0 });
  });
});
