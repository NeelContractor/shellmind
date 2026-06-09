import * as fs from "fs/promises";
import * as path from "path";

export async function readFile(args: { path: string }): Promise<string> {
    try {
        const resolved = path.resolve(args.path);
        const content = await fs.readFile(resolved, "utf-8");
        const lines = content.split("\n")
        const lineCount = lines.length;

        // Truncate very large files
        if (lineCount > 500) {
            const truncated = lines.slice(0, 500).join("\n")
            return `${truncated}\n\n[... file truncated at 500 lines, total: ${lineCount} lines]`
        }

        return content;
    } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException
        if (error.code === 'ENOENT') {
            return `Error: File not found: ${args.path}`
        }
        if (error.code === "EISDIR") {
            // If it's a directory, list it instead
            try {
                const entries = await fs.readdir(args.path)
                return `Directory listing for ${args.path}:\n${entries.join("\n")}`
            } catch {
                return `Error: ${args.path} is a directory`
            }
        }
        return `Error reading file: ${error.message}`
    }
}