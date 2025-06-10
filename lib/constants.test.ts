import { describe, expect,it } from 'vitest';

import { SESSION_KEYS } from './constants';

describe('SESSION_KEYS', () => {
  it('contains expected keys', () => {
    expect(SESSION_KEYS).toEqual(
      expect.objectContaining({
        CODE_VERIFIER: 'mcp_code_verifier',
        SERVER_URL: 'mcp_server_url',
        TOKENS: 'mcp_tokens',
        CLIENT_INFORMATION: 'mcp_client_information',
        MCP_SERVER_UUID: 'mcp_server_uuid',
        PROFILE_UUID: 'profile_uuid',
      })
    );
  });
});
