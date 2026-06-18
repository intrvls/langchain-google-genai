import { describe, test, expect } from "vitest";
import {
  convertResponseContentToChatGenerationChunk,
  convertMessageContentToParts,
  convertUsageMetadata,
  mapGenerateContentResultToChatResult,
} from "../utils/common.js";
import { AIMessage } from "@langchain/core/messages";
import type {
  Candidate,
  FinishReason,
  GenerateContentResponse,
} from "@google/genai";
import type { GoogleGenerativeAIPart } from "../types.js";

type ThinkingBlock = { type: "thinking"; thinking: string; signature?: string };
type TextBlock = { type: "text"; text: string };

function createMockResponse(candidates: Candidate[]): GenerateContentResponse {
  // The functions under test only read `candidates`/`usageMetadata`/
  // `promptFeedback`, so a minimal structural stand-in for the
  // `GenerateContentResponse` class is sufficient here.
  return { candidates } as unknown as GenerateContentResponse;
}

// https://github.com/langchain-ai/langchainjs/issues/9724
describe("Thinking content handling", () => {
  test("should separate thinking and text content blocks", () => {
    const mockResponse = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              text: "Let me think about this...",
              thought: true,
              thoughtSignature: "abc123",
            },
            {
              text: "The answer is 4.",
            },
          ] as GoogleGenerativeAIPart[],
        },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const result = mapGenerateContentResultToChatResult(mockResponse);

    expect(result.generations).toHaveLength(1);
    const content = result.generations[0].message.content;

    // Content should be an array
    expect(Array.isArray(content)).toBe(true);
    if (!Array.isArray(content)) return;
    expect(content.length).toBe(2);

    // First block should be thinking type
    const thinkingBlock = content[0] as ThinkingBlock;
    expect(thinkingBlock.type).toBe("thinking");
    expect(thinkingBlock.thinking).toBe("Let me think about this...");
    expect(thinkingBlock.signature).toBe("abc123");

    // Second block should be text type
    const textBlock = content[1] as TextBlock;
    expect(textBlock.type).toBe("text");
    expect(textBlock.text).toBe("The answer is 4.");
  });

  test("should handle thinking blocks without signatures", () => {
    const mockResponse = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              text: "Thinking content",
              thought: true,
            },
          ] as GoogleGenerativeAIPart[],
        },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const result = mapGenerateContentResultToChatResult(mockResponse);
    const content = result.generations[0].message.content;

    if (!Array.isArray(content)) return;
    const thinkingBlock = content[0] as ThinkingBlock;
    expect(thinkingBlock.type).toBe("thinking");
    expect(thinkingBlock.thinking).toBe("Thinking content");
    expect(thinkingBlock.signature).toBeUndefined();
  });

  test("should handle regular text without thought flag", () => {
    const mockResponse = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              text: "Regular response",
            },
          ],
        },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const result = mapGenerateContentResultToChatResult(mockResponse);

    // When there's only one text part, it should be a string
    expect(typeof result.generations[0].message.content).toBe("string");
    expect(result.generations[0].message.content).toBe("Regular response");
  });
});

describe("Streaming thinking content handling", () => {
  test("should separate thinking and text content blocks in streaming", () => {
    const mockResponse = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              text: "Let me think about this...",
              thought: true,
              thoughtSignature: "abc123",
            },
            {
              text: "The answer is 4.",
            },
          ] as GoogleGenerativeAIPart[],
        },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const result = convertResponseContentToChatGenerationChunk(mockResponse, {
      index: 0,
    });

    expect(result).not.toBeNull();
    const content = result!.message.content;

    // Content should be an array with separate blocks
    expect(Array.isArray(content)).toBe(true);
    if (!Array.isArray(content)) return;
    expect(content.length).toBe(2);

    // First block should be thinking type
    const thinkingBlock = content[0] as ThinkingBlock;
    expect(thinkingBlock.type).toBe("thinking");
    expect(thinkingBlock.thinking).toBe("Let me think about this...");
    expect(thinkingBlock.signature).toBe("abc123");

    // Second block should be text type
    const textBlock = content[1] as TextBlock;
    expect(textBlock.type).toBe("text");
    expect(textBlock.text).toBe("The answer is 4.");
  });

  test("should handle thinking blocks without signatures in streaming", () => {
    const mockResponse = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              text: "Thinking content",
              thought: true,
            },
          ] as GoogleGenerativeAIPart[],
        },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const result = convertResponseContentToChatGenerationChunk(mockResponse, {
      index: 0,
    });

    expect(result).not.toBeNull();
    const content = result!.message.content;

    if (!Array.isArray(content)) return;
    const thinkingBlock = content[0] as ThinkingBlock;
    expect(thinkingBlock.type).toBe("thinking");
    expect(thinkingBlock.thinking).toBe("Thinking content");
    expect(thinkingBlock.signature).toBeUndefined();
  });

  test("should handle regular text without thought flag in streaming", () => {
    const mockResponse = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              text: "Regular response",
            },
          ],
        },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const result = convertResponseContentToChatGenerationChunk(mockResponse, {
      index: 0,
    });

    expect(result).not.toBeNull();
    // When all parts are plain text (no thought flag), it should be a string
    expect(typeof result!.message.content).toBe("string");
    expect(result!.message.content).toBe("Regular response");
  });

  test("should not concatenate thinking and text into string in streaming", () => {
    // This test verifies the fix for the bug where thinking+text was concatenated
    const mockResponse = createMockResponse([
      {
        content: {
          role: "model",
          parts: [
            {
              text: "Thinking...",
              thought: true,
            },
            {
              text: "Answer",
            },
          ] as GoogleGenerativeAIPart[],
        },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const result = convertResponseContentToChatGenerationChunk(mockResponse, {
      index: 0,
    });

    expect(result).not.toBeNull();
    const content = result!.message.content;

    // Should NOT be a concatenated string like "Thinking...Answer"
    expect(typeof content).not.toBe("string");
    expect(Array.isArray(content)).toBe(true);
  });
});

// https://github.com/langchain-ai/langchainjs/issues/10103
describe("Round-trip thinking content handling", () => {
  test("thinking block with signature converts back to Gemini part", () => {
    const message = new AIMessage({
      content: [
        {
          type: "thinking",
          thinking: "Let me reason about this...",
          signature: "sig123",
        },
        { type: "text", text: "The answer is 42." },
      ],
    });

    const parts = convertMessageContentToParts(message, true, []);

    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({
      text: "Let me reason about this...",
      thought: true,
      thoughtSignature: "sig123",
    });
    expect(parts[1]).toEqual({ text: "The answer is 42." });
  });

  test("thinking block without signature converts back without thoughtSignature", () => {
    const message = new AIMessage({
      content: [
        { type: "thinking", thinking: "Some thinking" },
        { type: "text", text: "Some answer" },
      ],
    });

    const parts = convertMessageContentToParts(message, true, []);

    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({
      text: "Some thinking",
      thought: true,
    });
    expect(parts[0]).not.toHaveProperty("thoughtSignature");
    expect(parts[1]).toEqual({ text: "Some answer" });
  });

  test("thinking-only content (no text block) works", () => {
    const message = new AIMessage({
      content: [
        {
          type: "thinking",
          thinking: "Only thinking, no answer",
          signature: "sigABC",
        },
      ],
    });

    const parts = convertMessageContentToParts(message, true, []);

    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({
      text: "Only thinking, no answer",
      thought: true,
      thoughtSignature: "sigABC",
    });
  });

  test("full round-trip: Gemini response -> LangChain -> Gemini parts", () => {
    const originalParts = [
      {
        text: "Let me think step by step...",
        thought: true,
        thoughtSignature: "roundtrip-sig",
      },
      {
        text: "The final answer is 7.",
      },
    ] as GoogleGenerativeAIPart[];

    // Gemini response -> LangChain AIMessage
    const mockResponse = createMockResponse([
      {
        content: { role: "model", parts: originalParts },
        finishReason: "STOP" as FinishReason,
        index: 0,
        safetyRatings: [],
      },
    ]);

    const chatResult = mapGenerateContentResultToChatResult(mockResponse);
    const aiMessage = chatResult.generations[0].message;

    // LangChain AIMessage -> Gemini parts (outgoing direction)
    const roundTrippedParts = convertMessageContentToParts(aiMessage, true, []);

    expect(roundTrippedParts).toHaveLength(2);
    expect(roundTrippedParts[0]).toEqual({
      text: "Let me think step by step...",
      thought: true,
      thoughtSignature: "roundtrip-sig",
    });
    expect(roundTrippedParts[1]).toEqual({
      text: "The final answer is 7.",
    });
  });
});

describe("convertUsageMetadata", () => {
  type Usage = NonNullable<GenerateContentResponse["usageMetadata"]>;

  test("maps thinking tokens into output_tokens and output_token_details.reasoning", () => {
    // Gemini reports thoughts separately; candidatesTokenCount excludes them,
    // totalTokenCount includes them.
    const usage = {
      promptTokenCount: 10,
      candidatesTokenCount: 20,
      thoughtsTokenCount: 7,
      totalTokenCount: 37,
    } as Usage;

    const result = convertUsageMetadata(usage, "gemini-3.5-flash");

    expect(result.input_tokens).toBe(10);
    expect(result.output_tokens).toBe(27); // 20 candidates + 7 thoughts
    expect(result.total_tokens).toBe(37);
    expect(result.output_token_details?.reasoning).toBe(7);
    // input + output should reconcile to total
    expect(result.input_tokens + result.output_tokens).toBe(result.total_tokens);
  });

  test("omits reasoning details when there are no thinking tokens", () => {
    const usage = {
      promptTokenCount: 5,
      candidatesTokenCount: 8,
      totalTokenCount: 13,
    } as Usage;

    const result = convertUsageMetadata(usage, "gemini-2.5-flash");

    expect(result.output_tokens).toBe(8);
    expect(result.output_token_details).toBeUndefined();
  });

  test("reports >200k input bracket for gemini-3 pro models (precedence bug fixed)", () => {
    const usage = {
      promptTokenCount: 250_000,
      candidatesTokenCount: 100,
      totalTokenCount: 250_100,
    } as Usage;

    const result = convertUsageMetadata(usage, "gemini-3.1-pro-preview");

    // 250k - 200k = 50k over the bracket (previously the subtraction never ran)
    expect(result.input_token_details?.over_200k).toBe(50_000);
  });

  test("does not apply the >200k bracket to non-pro models", () => {
    const usage = {
      promptTokenCount: 250_000,
      candidatesTokenCount: 100,
      totalTokenCount: 250_100,
    } as Usage;

    const result = convertUsageMetadata(usage, "gemini-3.5-flash");

    expect(result.input_token_details?.over_200k).toBeUndefined();
  });
});
