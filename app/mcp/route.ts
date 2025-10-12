import { baseURL } from "@/baseUrl";
import sampleDataset from "@/data/mcp-sample-data.json";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const getAppsSdkCompatibleHtml = async (baseUrl: string, path: string) => {
  const result = await fetch(`${baseUrl}${path}`);
  return await result.text();
};

type ContentWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  html: string;
  description: string;
};

function widgetMeta(widget: ContentWidget) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": false,
    "openai/resultCanProduceWidget": true,
  } as const;
}

const cloneResponse = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
};

type SampleDataset = typeof sampleDataset;
type ToolResponse = SampleDataset["examples"][number]["response"];

const sampleResponseMap = new Map<
  string,
  SampleDataset["examples"][number]["response"]
>(
  sampleDataset.examples.map((example) => [
    example.input.name.trim().toLowerCase(),
    example.response,
  ])
);

const handler = createMcpHandler(async (server) => {
  const html = await getAppsSdkCompatibleHtml(baseURL, "/");

  const contentWidget: ContentWidget = {
    ...sampleDataset.tool,
    html,
  };
  server.registerResource(
    "content-widget",
    contentWidget.templateUri,
    {
      title: contentWidget.title,
      description: contentWidget.description,
      mimeType: "text/html+skybridge",
      _meta: {
        "openai/widgetDescription": contentWidget.description,
        "openai/widgetPrefersBorder": true,
      },
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html+skybridge",
          text: `<html>${contentWidget.html}</html>`,
          _meta: {
            "openai/widgetDescription": contentWidget.description,
            "openai/widgetPrefersBorder": true,
          },
        },
      ],
    })
  );

  const toolHandler = (async (
    { name }: { name: string },
    _extra: Parameters<typeof server.registerTool>[2] extends (
      ...args: infer P
    ) => any
      ? P[1]
      : never
  ) => {
    const normalizedName = name.trim() || "Guest";
    const sample = sampleResponseMap.get(normalizedName.toLowerCase());

    if (sample) {
      const clonedSample = cloneResponse(sample);

      return {
        ...clonedSample,
        _meta: widgetMeta(contentWidget),
      } satisfies ToolResponse;
    }

    const fallbackResponse: ToolResponse = {
      content: [
        {
          type: "text",
          text: `Here is the homepage for ${normalizedName}.`,
        } as unknown as ToolResponse["content"][number],
        {
          type: "resource",
          resource: {
            uri: contentWidget.templateUri,
            text: contentWidget.title,
            mimeType: "text/html+skybridge",
          },
        } as unknown as ToolResponse["content"][number],
      ],
      structuredContent: {
        name: normalizedName,
        timestamp: new Date().toISOString(),
      },
      _meta: widgetMeta(contentWidget),
    };

    return fallbackResponse;
  }) as unknown as Parameters<typeof server.registerTool>[2];

  server.registerTool(
    contentWidget.id,
    {
      title: contentWidget.title,
      description:
        "Fetch and display the homepage content with the name of the user",
      inputSchema: {
        name: z
          .string()
          .describe("The name of the user to display on the homepage"),
      },
      _meta: widgetMeta(contentWidget),
    },
    toolHandler
  );
});

const withCors = (response: Response) => {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept"
  );
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
  return response;
};

const ensureStreamableAcceptHeader = async (request: Request) => {
  const acceptHeader = request.headers.get("accept") || "";

  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  if (request.method === "HEAD") {
    return withCors(new Response(null, { status: 200 }));
  }

  if (request.method === "GET") {
    return withCors(Response.json({ status: "ok" }));
  }

  if (acceptHeader.includes("text/event-stream")) {
    return withCors(await handler(request));
  }

  const values = new Set(
    acceptHeader
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

  values.add("application/json");
  values.add("text/event-stream");

  const newHeaders = new Headers(request.headers);
  newHeaders.set("accept", Array.from(values).join(", "));

  const updatedRequest = new Request(request, { headers: newHeaders });

  const response = await handler(updatedRequest);

  return withCors(response);
};

export const GET = ensureStreamableAcceptHeader;
export const POST = ensureStreamableAcceptHeader;
export const HEAD = ensureStreamableAcceptHeader;
export const OPTIONS = ensureStreamableAcceptHeader;
