import { readFile } from "./readFile.ts";
import { writeFile } from "./writeFile.ts";
import { shell } from "./shell.ts";
import { webSearch } from "./webSearch.ts";

export async function executeTool(
    name: string,
    args: Record<string, unknown>
): Promise<string> {
    switch (name) {
        case "readFile":
            return readFile(args as { path: string });

        case "writeFile":
            return writeFile(args as { path: string; content: string });

        case "shell":
            return shell(args as { command: string });

        case "webSearch":
            return webSearch(args as { query: string });

        default:
            return `Unknown tool: ${name}`;
    }
}