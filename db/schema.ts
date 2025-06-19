import {
  OAuthClientInformation,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
// import { sql } from 'drizzle-orm'; // Will remove if not needed, or keep for '[]' defaults if preferred
import {
  index,
  integer, // Changed from timestamp, jsonb, serial, uuid, pgTable, pgEnum
  sqliteTable, // Changed from pgTable
  text,
  unique,
} from 'drizzle-orm/sqlite-core'; // Changed from pg-core
import { nanoid } from 'nanoid'; // For generating IDs

// Enums remain as TypeScript enums

export enum McpServerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUGGESTED = 'SUGGESTED',
  DECLINED = 'DECLINED',
}

export enum ToggleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum McpServerType {
  STDIO = 'STDIO',
  SSE = 'SSE',
  STREAMABLE_HTTP = 'STREAMABLE_HTTP',
}

export enum ProfileCapability {
  TOOLS_MANAGEMENT = 'TOOLS_MANAGEMENT',
  TOOL_LOGS = 'TOOL_LOGS',
}

// Removed WorkspaceMode enum

export enum ToolExecutionStatus {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  PENDING = 'PENDING',
}

// Removed pgEnum declarations

export const projectsTable = sqliteTable('projects', {
  uuid: text('uuid').primaryKey().$defaultFn(() => nanoid()),
  name: text('name').notNull(),
  created_at: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  active_profile_uuid: text('active_profile_uuid').references(
    () => profilesTable.uuid
  ),
});

export const profilesTable = sqliteTable(
  'profiles',
  {
    uuid: text('uuid').primaryKey().$defaultFn(() => nanoid()),
    name: text('name').notNull(),
    project_uuid: text('project_uuid')
      .notNull()
      .references(() => projectsTable.uuid, { onDelete: 'cascade' }),
    enabled_capabilities: text('enabled_capabilities', { mode: 'json' })
      .$type<ProfileCapability[]>()
      .notNull()
      .default('[]'),
    // Removed workspace_mode column
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index('profiles_project_uuid_idx').on(table.project_uuid)]
);

export const apiKeysTable = sqliteTable(
  'api_keys',
  {
    uuid: text('uuid').primaryKey().$defaultFn(() => nanoid()),
    project_uuid: text('project_uuid')
      .notNull()
      .references(() => projectsTable.uuid, { onDelete: 'cascade' }),
    api_key: text('api_key').notNull(),
    name: text('name').default('API Key'),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index('api_keys_project_uuid_idx').on(table.project_uuid)]
);

export const mcpServersTable = sqliteTable(
  'mcp_servers',
  {
    uuid: text('uuid').primaryKey().$defaultFn(() => nanoid()),
    name: text('name').notNull(),
    description: text('description'),
    type: text('type')
      .$type<McpServerType>()
      .notNull()
      .default(McpServerType.STDIO),
    command: text('command'),
    args: text('args', { mode: 'json' }) // Store as JSON string
      .$type<string[]>()
      .notNull()
      .default('[]'),
    env: text('env', { mode: 'json' }) // Store as JSON string
      .$type<{ [key: string]: string }>()
      .notNull()
      .default('{}'),
    url: text('url'),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    profile_uuid: text('profile_uuid')
      .notNull()
      .references(() => profilesTable.uuid),
    status: text('status')
      .$type<McpServerStatus>()
      .notNull()
      .default(McpServerStatus.ACTIVE),
  },
  (table) => [
    index('mcp_servers_status_idx').on(table.status),
    index('mcp_servers_profile_uuid_idx').on(table.profile_uuid),
    index('mcp_servers_type_idx').on(table.type),
    // Removed complex CHECK constraint, SQLite has limited support for regex in CHECK
  ]
);


export const toolsTable = sqliteTable(
  'tools',
  {
    uuid: text('uuid').primaryKey().$defaultFn(() => nanoid()),
    name: text('name').notNull(),
    description: text('description'),
    toolSchema: text('tool_schema', { mode: 'json' }) // Store as JSON string
      .$type<{
        type: 'object';
        properties?: Record<string, any>;
      }>()
      .notNull(),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    mcp_server_uuid: text('mcp_server_uuid')
      .notNull()
      .references(() => mcpServersTable.uuid, { onDelete: 'cascade' }),
    status: text('status').$type<ToggleStatus>().notNull().default(ToggleStatus.ACTIVE),
  },
  (table) => [
    index('tools_mcp_server_uuid_idx').on(table.mcp_server_uuid),
    unique('tools_unique_tool_name_per_server_idx').on(
      table.mcp_server_uuid,
      table.name
    ),
  ]
);

export const toolExecutionLogsTable = sqliteTable(
  'tool_execution_logs',
  {
    id: text('id').primaryKey().$defaultFn(() => nanoid()), // Changed from serial to text with nanoid
    mcp_server_uuid: text('mcp_server_uuid').references(
      () => mcpServersTable.uuid,
      { onDelete: 'cascade' }
    ),
    tool_name: text('tool_name').notNull(),
    payload: text('payload', { mode: 'json' }) // Store as JSON string
      .$type<Record<string, any>>()
      .notNull()
      .default('{}'),
    result: text('result', { mode: 'json' }).$type<any>(), // Store as JSON string
    status: text('status')
      .$type<ToolExecutionStatus>()
      .notNull()
      .default(ToolExecutionStatus.PENDING),
    error_message: text('error_message'),
    execution_time_ms: text('execution_time_ms'),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('tool_execution_logs_mcp_server_uuid_idx').on(table.mcp_server_uuid),
    index('tool_execution_logs_tool_name_idx').on(table.tool_name),
    index('tool_execution_logs_created_at_idx').on(table.created_at),
  ]
);

export const oauthSessionsTable = sqliteTable(
  'oauth_sessions',
  {
    uuid: text('uuid').primaryKey().$defaultFn(() => nanoid()),
    mcp_server_uuid: text('mcp_server_uuid')
      .notNull()
      .references(() => mcpServersTable.uuid, { onDelete: 'cascade' }),
    client_information: text('client_information', { mode: 'json' }) // Store as JSON string
      .$type<OAuthClientInformation>()
      .notNull(),
    tokens: text('tokens', { mode: 'json' }).$type<OAuthTokens>(), // Store as JSON string
    code_verifier: text('code_verifier'),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updated_at: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('oauth_sessions_mcp_server_uuid_idx').on(table.mcp_server_uuid),
    unique('oauth_sessions_unique_per_server_idx').on(table.mcp_server_uuid),
  ]
);
