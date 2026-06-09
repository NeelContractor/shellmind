import type { ToolDefinition } from "../llm/types.ts";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
    {
        name: "readFile",
        description:
        "Read the contents of a file at the given path. Use this to inspect code, config, or data files.",
        parameters: {
        type: "object",
        properties: {
            path: {
            type: "string",
            description: "Absolute or relative path to the file",
            },
        },
        required: ["path"],
        },
    },
    {
        name: "writeFile",
        description:
        "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Use for creating or editing code files.",
        parameters: {
        type: "object",
        properties: {
            path: {
            type: "string",
            description: "Path to write the file to",
            },
            content: {
            type: "string",
            description: "Full content to write to the file",
            },
        },
        required: ["path", "content"],
        },
    },
    {
        name: "shell",
        description:
        "Run a shell command and return its stdout/stderr output. Use for running tests, installing packages, checking git status, etc. Requires user approval for destructive commands.",
        parameters: {
        type: "object",
        properties: {
            command: {
            type: "string",
            description: "The shell command to execute",
            },
        },
        required: ["command"],
        },
    },
    {
        name: "webSearch",
        description:
        "Search the web for current information, documentation, or answers. Returns top search results with titles, URLs, and snippets.",
        parameters: {
        type: "object",
        properties: {
            query: {
            type: "string",
            description: "Search query",
            },
        },
        required: ["query"],
        },
    },
];