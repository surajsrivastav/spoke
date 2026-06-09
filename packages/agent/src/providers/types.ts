export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock;

export interface ModelResponse {
  content: ContentBlock[];
  inputTokens: number;
  outputTokens: number;
}

export type Message =
  | { role: 'user'; content: string | ToolResultBlock[] }
  | { role: 'assistant'; content: ContentBlock[] };

export interface LLMProvider {
  createMessage(
    model: string,
    maxTokens: number,
    messages: Message[],
    tools: ToolDefinition[],
  ): Promise<ModelResponse>;
}
