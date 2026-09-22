export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

export interface ToolSet {
  defs: ToolDefinition[];
  handlers: Record<string, ToolHandler>;
}
