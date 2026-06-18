import { test, beforeAll, expect } from "vitest";

import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import { GoogleGenAI, FileState } from "@google/genai";
import { ChatGoogleGenerativeAI } from "../chat_models.js";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

let model: ChatGoogleGenerativeAI;

beforeAll(
  async () => {
    // Download video file and save in src/tests/data
    // curl -O https://storage.googleapis.com/generativeai-downloads/data/Sherlock_Jr_FullMovie.mp4
    const displayName = "Sherlock Jr. video";

    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const pathToVideoFile = path.join(
      dirname,
      "/data/Sherlock_Jr_FullMovie.mp4"
    );

    // Auto-download the sample video on first run so the suite is runnable
    // without manual setup.
    if (!fs.existsSync(pathToVideoFile)) {
      fs.mkdirSync(path.dirname(pathToVideoFile), { recursive: true });
      const url =
        "https://storage.googleapis.com/generativeai-downloads/data/Sherlock_Jr_FullMovie.mp4";
      const res = await fetch(url);
      if (!res.ok || !res.body) {
        throw new Error(`Failed to download video fixture: ${res.status}`);
      }
      await pipeline(
        Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
        fs.createWriteStream(pathToVideoFile)
      );
    }

    const uploaded = await ai.files.upload({
      file: pathToVideoFile,
      config: {
        displayName,
        mimeType: "video/mp4",
      },
    });

    const name = uploaded.name ?? "";

    // Poll get() on a set interval (2 seconds here) to check file state.
    let file = await ai.files.get({ name });
    while (file.state === FileState.PROCESSING) {
      // Sleep for 2 seconds
      await new Promise((resolve) => {
        setTimeout(resolve, 2_000);
      });
      file = await ai.files.get({ name });
    }

    const systemInstruction =
      "You are an expert video analyzer, and your job is to answer " +
      "the user's query based on the video file you have access to.";
    const cachedContent = await ai.caches.create({
      model: "models/gemini-2.5-flash",
      config: {
        displayName: "gettysburg audio",
        systemInstruction,
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  mimeType: file.mimeType,
                  fileUri: file.uri,
                },
              },
            ],
          },
        ],
        ttl: "300s",
      },
    });

    // The cached content's server-generated resource name is passed to the
    // model so every request reuses the cached tokens.
    model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      cachedContent: cachedContent.name,
    });
  },
  10 * 60 * 1000
); // Set timeout to 10 minutes to upload file

test("Test Google AI", async () => {
  const res = await model.invoke(
    "Introduce different characters in the movie by describing " +
      "their personality, looks, and names. Also list the " +
      "timestamps they were introduced for the first time."
  );

  expect(res).toBeTruthy();
});
