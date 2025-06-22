import { OAuthClientInformation, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

export type OAuthSession = {
  uuid: string;
  mcp_server_uuid: string;
  client_information: OAuthClientInformation;
  tokens: OAuthTokens | null;
  code_verifier: string | null;
  created_at: Date;
  updated_at: Date;
};
