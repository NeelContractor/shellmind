import * as fs from "fs/promises";
import * as path from "path";

export async function writeFile(args: { path: string; content: string }): Promise<string> {
    try {
        const resolved = path.resolve(args.path);

        // Ensure parent directories exist
        const dir = path.dirname(resolved);
        await fs.mkdir(dir, { recursive: true });

        // Check if file exists to report create vs update
        let existed = false;
        try {
            await fs.access(resolved);
            existed = true;
        } catch {}

        await fs.writeFile(resolved, args.content, "utf-8");

        const lines = args.content.split("\n").length;
        const bytes = Buffer.byteLength(args.content, "utf-8");
        const action = existed ? "Updated" : "Created";

        return `${action} ${resolved} (${lines} lines, ${bytes} bytes)`;
    } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        return `Error writing file: ${error.message}`;
    }
}