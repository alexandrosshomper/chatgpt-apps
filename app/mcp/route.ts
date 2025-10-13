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
  description: string;
};

function widgetMeta(widget: ContentWidget) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": true,
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
  let cachedContentWidgetHtml: string | undefined;
  const fallbackContentWidgetHtml = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Flyfish</title>
      <style>
        :root {
          color-scheme: light dark;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
          color: rgb(24 24 27);
          background: rgb(250 250 250);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        @media (prefers-color-scheme: dark) {
          body {
            color: rgb(228 228 231);
            background: rgb(15 15 15);
          }
        }

        main {
          width: min(560px, 100%);
          border-radius: 24px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(16px);
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        @media (prefers-color-scheme: dark) {
          main {
            background: rgba(24, 24, 27, 0.82);
            border-color: rgba(71, 85, 105, 0.6);
          }
        }

        h1 {
          margin: 0;
          font-size: 24px;
          line-height: 1.2;
        }

        p {
          margin: 0;
          line-height: 1.6;
        }

        .cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 600;
          text-decoration: none;
          border-radius: 9999px;
          padding: 10px 18px;
          color: rgb(15 23 42);
          background: linear-gradient(135deg, #38bdf8, #6366f1);
          transition: transform 120ms ease, box-shadow 120ms ease;
          box-shadow: 0 10px 24px rgba(59, 130, 246, 0.25);
        }

        .cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 30px rgba(59, 130, 246, 0.32);
        }

        .cta:focus-visible {
          outline: 3px solid rgba(37, 99, 235, 0.5);
          outline-offset: 2px;
        }

        .detail {
          font-size: 14px;
          color: rgb(71 85 105);
        }

        @media (prefers-color-scheme: dark) {
          .cta {
            color: rgb(226 232 240);
            box-shadow: 0 12px 30px rgba(99, 102, 241, 0.4);
          }

          .detail {
            color: rgb(148 163 184);
          }
        }
      </style>
    </head>
    <body>
      <main>
        <h1>Flyfish</h1>
        <p id="welcome">Welcome to the Flyfish home experience.</p>
        <p class="detail">
          Signed in as <strong id="visitor">...</strong>
        </p>
        <p class="detail" id="timestamp" hidden></p>
        <a
          class="cta"
          href="${baseURL}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open full app
        </a>
      </main>
      <script>
        const EVENT_NAME = "openai:set_globals";
        const visitorElement = document.getElementById("visitor");
        const timestampElement = document.getElementById("timestamp");

        const readToolOutput = () => {
          const toolOutput = window.openai?.toolOutput ?? null;
          if (!toolOutput) {
            return { name: "Guest", timestamp: null };
          }

          const structured = toolOutput.result?.structuredContent ?? {};
          const name = structured.name || toolOutput.name || "Guest";
          const timestamp = structured.timestamp || null;
          return { name, timestamp };
        };

        const formatTimestamp = (value) => {
          if (!value) {
            return "";
          }

          try {
            const formatter = new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            });
            return formatter.format(new Date(value));
          } catch (error) {
            console.warn("Unable to format timestamp", error);
            return value;
          }
        };

        const updateVisitor = () => {
          const { name, timestamp } = readToolOutput();
          visitorElement.textContent = name || "Guest";
          document.title = name ? "Flyfish • " + name : "Flyfish";

          if (timestamp) {
            timestampElement.textContent =
              "Last updated " + formatTimestamp(timestamp);
            timestampElement.hidden = false;
          } else {
            timestampElement.hidden = true;
          }
        };

        updateVisitor();

        window.addEventListener(EVENT_NAME, updateVisitor, { passive: true });
      </script>
    </body>
  </html>`;

  const getContentWidgetHtml = async () => {
    if (cachedContentWidgetHtml) {
      return cachedContentWidgetHtml;
    }

    try {
      // Fetch the rendered homepage lazily so that connector handshakes do not block on
      // building the Next.js app. The result is cached for subsequent requests.
      cachedContentWidgetHtml = await getAppsSdkCompatibleHtml(baseURL, "/");
      return cachedContentWidgetHtml;
    } catch (error) {
      console.error("Failed to fetch content widget HTML", error);
      cachedContentWidgetHtml = fallbackContentWidgetHtml;
      return fallbackContentWidgetHtml;
    }
  };

  const contentWidget: ContentWidget = {
    ...sampleDataset.tool,
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
    async (uri) => {
      const html = await getContentWidgetHtml();

      const normalizedHtml = html.trim().startsWith("<!doctype")
        ? html
        : html.trim().startsWith("<html")
          ? html
          : `<html>${html}</html>`;

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/html+skybridge",
            text: normalizedHtml,
            _meta: {
              "openai/widgetDescription": contentWidget.description,
              "openai/widgetPrefersBorder": true,
            },
          },
        ],
      };
    }
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

const withCors = (response: Response, request?: Request) => {
  response.headers.set("Access-Control-Allow-Origin", "*");

  const requestedHeaders = request?.headers
    .get("access-control-request-headers")
    ?.trim();

  response.headers.set(
    "Access-Control-Allow-Headers",
    requestedHeaders && requestedHeaders.length > 0
      ? requestedHeaders
      : "Content-Type, Authorization, Accept"
  );
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
  return response;
};

const ensureStreamableAcceptHeader = async (request: Request) => {
  const acceptHeader = request.headers.get("accept") || "";

  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }), request);
  }

  if (request.method === "HEAD") {
    return withCors(new Response(null, { status: 200 }), request);
  }

  if (request.method === "GET") {
    return withCors(Response.json({ status: "ok" }), request);
  }

  if (acceptHeader.includes("text/event-stream")) {
    return withCors(await handler(request), request);
  }

  const values = new Set(
    acceptHeader
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

  values.add("application/json");
  values.add("text/event-stream");

  const updatedHeaders = new Headers(request.headers);
  updatedHeaders.set("accept", Array.from(values).join(", "));

  const shouldHaveBody =
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.method !== "OPTIONS" &&
    request.method !== "TRACE";

  const requestBody = shouldHaveBody ? await request.text() : undefined;

  if (shouldHaveBody && (!requestBody || !requestBody.trim())) {
    return withCors(
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: "Parse error: request body is empty.",
          },
          id: null,
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      ),
      request
    );
  }

  const updatedRequestInit: RequestInit = {
    method: request.method,
    headers: updatedHeaders,
    signal: request.signal,
  };

  if (shouldHaveBody && typeof requestBody === "string") {
    updatedRequestInit.body = requestBody;
  }

  const updatedRequest = new Request(request.url, updatedRequestInit);

  try {
    const response = await handler(updatedRequest);

    return withCors(response, request);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return withCors(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32700,
              message: "Parse error: invalid JSON body.",
            },
            id: null,
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          }
        ),
        request
      );
    }

    throw error;
  }
};

export const GET = ensureStreamableAcceptHeader;
export const POST = ensureStreamableAcceptHeader;
export const HEAD = ensureStreamableAcceptHeader;
export const OPTIONS = ensureStreamableAcceptHeader;
