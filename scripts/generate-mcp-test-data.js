#!/usr/bin/env node
const { writeFileSync, mkdirSync } = require("fs");
const { join } = require("path");

const OUTPUT_DIR = "data";
const OUTPUT_FILE = "mcp-sample-data.json";

const contentWidget = {
  id: "show_content",
  title: "Show Content",
  templateUri: "ui://widget/content-template.html",
  invoking: "Loading content...",
  invoked: "Content loaded",
  description: "Displays the homepage content",
};

const names = [
  "Avery Johnson",
  "Jordan Lee",
  "Morgan Patel",
  "Quinn Alvarez",
  "Taylor Nakamura",
];

const baseTimestamp = new Date("2024-01-01T12:00:00.000Z").getTime();

const examples = names.map((name, index) => {
  const timestamp = new Date(baseTimestamp + index * 15 * 60 * 1000).toISOString();

  return {
    input: {
      name,
    },
    response: {
      content: [
        {
          type: "text",
          text: name,
        },
      ],
      structuredContent: {
        name,
        timestamp,
      },
      _meta: {
        "openai/outputTemplate": contentWidget.templateUri,
        "openai/toolInvocation/invoking": contentWidget.invoking,
        "openai/toolInvocation/invoked": contentWidget.invoked,
        "openai/widgetAccessible": false,
        "openai/resultCanProduceWidget": true,
      },
    },
  };
});

const payload = {
  generatedAt: new Date(baseTimestamp).toISOString(),
  description:
    "Sample invocations of the show_content MCP tool. Timestamps are deterministic for repeatable tests.",
  tool: contentWidget,
  examples,
};

mkdirSync(OUTPUT_DIR, { recursive: true });

const outputPath = join(OUTPUT_DIR, OUTPUT_FILE);
writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n");

console.log(`Generated ${examples.length} MCP sample responses at ${outputPath}`);
