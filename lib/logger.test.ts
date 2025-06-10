import { describe, expect, it, vi } from 'vitest';

import * as logger from './logger';

describe('logger', () => {
  it('calls console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.log('hello');
    expect(spy).toHaveBeenCalledWith('hello');
    spy.mockRestore();
  });

  it('calls console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('warn');
    expect(spy).toHaveBeenCalledWith('warn');
    spy.mockRestore();
  });

  it('calls console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('err');
    expect(spy).toHaveBeenCalledWith('err');
    spy.mockRestore();
  });
});
