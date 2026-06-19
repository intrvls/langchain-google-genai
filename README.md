# @intrvls/langchain-google-genai

This package contains LangChain.js integrations for Google's Gemini models.

## Why this port exists

This is a standalone port of the official [`@langchain/google-genai`](https://www.npmjs.com/package/@langchain/google-genai) package at version **2.1.24**, with three key differences:

1. **New SDK.** It is built on Google's current [`@google/genai`](https://www.npmjs.com/package/@google/genai) SDK rather than the legacy `@google/generative-ai` SDK, which Google has deprecated in favor of the unified GenAI SDK (see Google's [migration guide](https://ai.google.dev/gemini-api/docs/migrate)). The legacy SDK no longer receives new Gemini features, so staying on it blocks access to newer models and capabilities.
2. **Standalone.** The upstream package lives inside the LangChain.js monorepo and depends on workspace-only tooling (`@langchain/build`, `@langchain/tsconfig`, `@langchain/standard-tests`). This port removes those couplings so it can be installed, built, and tested on its own, published under the `@intrvls` scope.
3. **Pinned to n8n's `@langchain/core` line.** This is intended for use inside a custom n8n community node. n8n's [`@n8n/n8n-nodes-langchain`](https://www.npmjs.com/package/@n8n/n8n-nodes-langchain) pins `@langchain/core` to `1.1.41`, and at runtime everything must resolve to that single core instance. We therefore re-base on upstream **2.1.24** — the last line that targets `@langchain/core` 1.1.x (peer `^1.1.30`) — rather than 2.2.0+, which requires core ≥1.2.0 APIs n8n does not ship. `@langchain/core` stays a `peerDependency` so the host (n8n) supplies the instance.

It keeps the same public API (`ChatGoogleGenerativeAI`, `GoogleGenerativeAIEmbeddings`) so it can be used as a drop-in replacement.

## Version compatibility

This port follows its own version line as of **3.0.0** and no longer mirrors upstream's `2.1.x` numbering. The table below describes the current release.

| | Version | Notes |
| --- | --- | --- |
| **This package** | `3.0.0-alpha.0` | Independent version line (see [CHANGELOG](./CHANGELOG.md)). |
| **Mirrors upstream** | `@langchain/google-genai` **2.1.24** | The upstream release this port is rebased from — the last line targeting `@langchain/core` 1.1.x. Not the version you install. |
| **`@langchain/core`** | peer `^1.1.30` | Supplied by the host as a `peerDependency`. Tested against **1.1.41**, the version n8n's [`@n8n/n8n-nodes-langchain`](https://www.npmjs.com/package/@n8n/n8n-nodes-langchain) ships. Must resolve to a single instance at runtime. Do **not** use core `≥1.2.0` — upstream `2.2.0+` requires APIs n8n does not ship. |
| **`@google/genai`** | `^2.8.0` | Google's current unified GenAI SDK (replaces the deprecated `@google/generative-ai`). Bundled dependency. |
| **Node.js** | `>=20` | |

> **Why pinned to core 1.1.x?** This is built for use inside a custom n8n community node, and everything in an n8n process must resolve to the one `@langchain/core` instance n8n provides (1.1.41). Rebasing on upstream 2.1.24 — rather than 2.2.0+ — keeps the port on the core 1.1.x line so it stays compatible.

## Installation

```bash npm2yarn
npm install @intrvls/langchain-google-genai @langchain/core
```

The current release is an alpha. To install it, use the `alpha` tag:

```bash
npm install @intrvls/langchain-google-genai@alpha @langchain/core
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of @langchain/core.
You can do so by adding appropriate field to your project's `package.json` like this:

```json
{
  "name": "your-project",
  "version": "0.0.0",
  "dependencies": {
    "@langchain/core": "^1.1.30",
    "@intrvls/langchain-google-genai": "^3.0.0-alpha.0"
  },
  "resolutions": {
    "@langchain/core": "^1.1.30"
  },
  "overrides": {
    "@langchain/core": "^1.1.30"
  },
  "pnpm": {
    "overrides": {
      "@langchain/core": "^1.1.30"
    }
  }
}
```

The field you need depends on the package manager you're using, but we recommend adding a field for the common `yarn`, `npm`, and `pnpm` to maximize compatibility.

## Chat Models

This package contains the `ChatGoogleGenerativeAI` class, which is the recommended way to interface with the Google Gemini series of models.

To use, install the requirements, and configure your environment.

```bash
export GOOGLE_API_KEY=your-api-key
# or, equivalently:
export GEMINI_API_KEY=your-api-key
```

`GOOGLE_API_KEY` takes precedence; `GEMINI_API_KEY` is used as a fallback. You can also pass the key directly via the `apiKey` constructor field. This applies to both `ChatGoogleGenerativeAI` and `GoogleGenerativeAIEmbeddings`.

Then initialize

```typescript
import { ChatGoogleGenerativeAI } from "@intrvls/langchain-google-genai";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-3.5-flash",
  maxOutputTokens: 2048,
});
const response = await model.invoke(new HumanMessage("Hello world!"));
```

#### Multimodal inputs

Gemini models support image inputs when providing a single chat message. Example:

```bash npm2yarn
pnpm install @langchain/core
```

```typescript
import fs from "fs";
import { ChatGoogleGenerativeAI } from "@intrvls/langchain-google-genai";
import { HumanMessage } from "@langchain/core/messages";

const vision = new ChatGoogleGenerativeAI({
  model: "gemini-3.5-flash",
  maxOutputTokens: 2048,
});
const image = fs.readFileSync("./hotdog.jpg").toString("base64");
const input = [
  new HumanMessage({
    content: [
      {
        type: "text",
        text: "Describe the following image.",
      },
      {
        type: "image_url",
        image_url: `data:image/png;base64,${image}`,
      },
    ],
  }),
];

const res = await vision.invoke(input);
```

The value of `image_url` can be any of the following:

- A public image URL
- An accessible gcs file (e.g., "gcs://path/to/file.png")
- A base64 encoded image (e.g., `data:image/png;base64,abcd124`)
- A PIL image

## Embeddings

This package also adds support for google's embeddings models.

```typescript
import { GoogleGenerativeAIEmbeddings } from "@intrvls/langchain-google-genai";

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001", // current default; the legacy `embedding-001` is retired
  taskType: "RETRIEVAL_DOCUMENT",
  title: "Document title",
});

const res = await embeddings.embedQuery("OK Google");
```

## Behavior notes

A few conveniences this port applies on top of the upstream behavior:

- **Gemini 3+ default temperature.** For Gemini 3 and later models, if you don't set `temperature` explicitly it defaults to `1.0`. These models can loop or degrade at `temperature < 1.0`; explicit values are always respected, and older models are unaffected.
- **Google Search tool.** The legacy `googleSearchRetrieval` tool shape is automatically rewritten to `googleSearch`, which is required by current Gemini models — existing calling code keeps working.
- **API key fallback.** `GEMINI_API_KEY` is honored as a fallback to `GOOGLE_API_KEY` (see above).
- **Reasoning content.** When `thinkingConfig.includeThoughts` is enabled, thinking is surfaced as standard `reasoning` content blocks via `message.contentBlocks` on both `invoke` and `stream`.

## Development

To develop the Google GenAI package, you'll need to follow these instructions:

### Install dependencies

```bash
pnpm install
```

### Build the package

```bash
pnpm build
```

### Run tests

Test files should live within a `tests/` file in the `src/` folder. Unit tests should end in `.test.ts` and integration tests should
end in `.int.test.ts`:

```bash
$ pnpm test
$ pnpm test:int
```

### Lint & Format

Run the linter & formatter to ensure your code is up to standard:

```bash
pnpm lint && pnpm format
```

### Adding new entrypoints

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to the `exports` field in the `package.json` file and run `pnpm build` to generate the new entrypoint.
