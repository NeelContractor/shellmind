export async function webSearch(args: { query: string }): Promise<string> {
    const braveKey = process.env.BRAVE_API_KEY;
  
    if (braveKey) {
        return braveSearch(args.query, braveKey);
    }
  
    // Fallback: DuckDuckGo instant answers (no key required)
    return duckduckgoSearch(args.query);
}
  
async function braveSearch(query: string, apiKey: string): Promise<string> {
    try {
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
        const res = await fetch(url, {
            headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip",
                "X-Subscription-Token": apiKey,
            },
        });
  
        if (!res.ok) {
            return `Search failed: HTTP ${res.status}`;
        }
  
        const data = (await res.json()) as {
            web?: { results?: Array<{ title: string; url: string; description?: string }> };
        };
        const results = data.web?.results ?? [];
  
        if (results.length === 0) {
            return "No results found.";
        }
    
        return results
            .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.description ?? ""}`)
            .join("\n\n");
    } catch (err) {
        return `Search error: ${(err as Error).message}`;
    }
}
  
async function duckduckgoSearch(query: string): Promise<string> {
    try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const res = await fetch(url, {
            headers: { "User-Agent": "code-agent/1.0" },
        });

        const data = (await res.json()) as {
            AbstractText?: string;
            AbstractURL?: string;
            RelatedTopics?: Array<{
                FirstURL?: string;
                Text?: string;
                Topics?: Array<{ FirstURL?: string; Text?: string }>;
            }>;
        };

        const results: string[] = [];
    
        if (data.AbstractText) {
            results.push(`**Summary:** ${data.AbstractText}\n   Source: ${data.AbstractURL}`);
        }

        const topics = (data.RelatedTopics ?? []).slice(0, 4);
        for (const topic of topics) {
            if (topic.Text && topic.FirstURL) {
                results.push(`• ${topic.Text}\n  ${topic.FirstURL}`);
            }
        }
    
        if (results.length === 0) {
            return `No instant results for "${query}". Try a Brave API key for full web search.`;
        }
    
        return results.join("\n\n");
    } catch (err) {
        return `Search error: ${(err as Error).message}`;
    }
}