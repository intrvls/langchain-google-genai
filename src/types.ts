import { Tool, Part } from "@google/genai";
import { BindToolsInput } from "@langchain/core/language_models/chat_models";

/**
 * Tools accepted by `ChatGoogleGenerativeAI`.
 *
 * In `@google/genai` the previously distinct tool shapes
 * (`FunctionDeclarationsTool`, `CodeExecutionTool`,
 * `GoogleSearchRetrievalTool`, ...) have all been folded into a single
 * `Tool` interface whose fields (`functionDeclarations`, `codeExecution`,
 * `googleSearch`/`googleSearchRetrieval`, ...) are individually optional.
 */
export type GoogleGenerativeAIToolType = BindToolsInput | Tool;

export type GoogleGenerativeAIThinkingConfig = {
  /** Indicates whether to include thoughts in the response. If true, thoughts are returned only when available. */
  includeThoughts?: boolean;
  /** The number of thoughts tokens that the model should generate. */
  thinkingBudget?: number;
  /** Optional. The level of thoughts tokens that the model should generate. */
  thinkingLevel?: GoogleGenerativeAIThinkingLevel;
};

export type GoogleGenerativeAIThinkingLevel =
  | "THINKING_LEVEL_UNSPECIFIED"
  | "MINIMAL"
  | "LOW"
  | "MEDIUM"
  | "HIGH";

/**
 * In `@google/genai`, `Part` natively carries the `thought` and
 * `thoughtSignature` fields, so the previous custom augmentation is no longer
 * required. Kept as an alias for backwards compatibility of internal imports.
 */
export type GoogleGenerativeAIPart = Part;
