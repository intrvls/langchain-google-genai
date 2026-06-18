/**
 * Smoke coverage for the latest Gemini models across the core capabilities of
 * ChatGoogleGenerativeAI. Existing suites pin almost everything to
 * gemini-2.5-*; this parameterized suite ensures the newest models keep
 * working end-to-end.
 *
 * Live model IDs (verified against the API):
 *  - gemini-3.1-flash-lite
 *  - gemini-3.5-flash
 *  - gemini-3.1-pro-preview   (the bare "gemini-3.1-pro" 404s)
 *
 * These are all Gemini 3 "thinking" models, so we give responses enough output
 * budget that thinking doesn't starve the visible answer.
 */
import { test, expect, describe } from "vitest";
import { concat } from "@langchain/core/utils/stream";
import { AIMessageChunk, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod/v3";
import { ChatGoogleGenerativeAI } from "../chat_models.js";

const LATEST_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.1-pro-preview",
] as const;

describe.each(LATEST_MODELS)("Latest model: %s", (model) => {
  test("invoke returns text content", async () => {
    const llm = new ChatGoogleGenerativeAI({
      model,
      maxRetries: 0,
      maxOutputTokens: 2048,
    });
    const res = await llm.invoke("What is the capital of France? Answer in one word.");
    expect(res.text.toLowerCase()).toContain("paris");
  });

  test("stream yields content and usage_metadata", async () => {
    const llm = new ChatGoogleGenerativeAI({
      model,
      maxRetries: 0,
      maxOutputTokens: 2048,
    });
    let final: AIMessageChunk | null = null;
    for await (const chunk of await llm.stream("Count from 1 to 3.")) {
      final = final ? concat(final, chunk) : chunk;
    }
    expect(final).not.toBeNull();
    expect(final!.text.length).toBeGreaterThan(0);
    expect(final!.usage_metadata).toBeDefined();
    expect(final!.usage_metadata!.input_tokens).toBeGreaterThan(0);
    expect(final!.usage_metadata!.output_tokens).toBeGreaterThan(0);
    expect(final!.usage_metadata!.total_tokens).toBe(
      final!.usage_metadata!.input_tokens + final!.usage_metadata!.output_tokens
    );
  });

  test("bindTools produces a tool call", async () => {
    const weatherTool = tool(async ({ city }) => `It is sunny in ${city}.`, {
      name: "get_weather",
      description: "Get the current weather for a city.",
      schema: z.object({ city: z.string().describe("The city name") }),
    });
    const llm = new ChatGoogleGenerativeAI({
      model,
      maxRetries: 0,
      maxOutputTokens: 2048,
      // Force a tool call: gemini-3 pro can emit a MALFORMED_FUNCTION_CALL with
      // auto tool-choice, so pin it to make tool-calling coverage deterministic.
    }).bindTools([weatherTool], { tool_choice: "any" });

    const res = await llm.invoke([
      new HumanMessage("What is the weather in Tokyo? Use the tool."),
    ]);
    expect(res.tool_calls?.length).toBeGreaterThan(0);
    expect(res.tool_calls?.[0].name).toBe("get_weather");
    expect(res.tool_calls?.[0].args.city.toLowerCase()).toContain("tokyo");
  });

  test("withStructuredOutput returns a parsed object", async () => {
    const schema = z.object({
      name: z.string().describe("The person's name"),
      age: z.number().describe("The person's age"),
    });
    const llm = new ChatGoogleGenerativeAI({
      model,
      maxRetries: 0,
      maxOutputTokens: 2048,
    }).withStructuredOutput(schema);

    const res = await llm.invoke("Extract: Alice is 30 years old.");
    expect(res.name.toLowerCase()).toContain("alice");
    expect(res.age).toBe(30);
  });

  test("thinking config surfaces reasoning content blocks", async () => {
    const llm = new ChatGoogleGenerativeAI({
      model,
      maxRetries: 0,
      maxOutputTokens: 4096,
      thinkingConfig: { includeThoughts: true, thinkingLevel: "HIGH" },
    });
    const res = await llm.invoke(
      "A train travels 60km in 1.5h then 90km in 2h. What is its average speed? Think step by step."
    );
    const reasoning = res.contentBlocks.filter((b) => b.type === "reasoning");
    expect(reasoning.length).toBeGreaterThan(0);
  });
});
