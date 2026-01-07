export type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AnthropicClientOptions = {
  apiKey: string;
  /** Claude model name. Example: claude-3-5-sonnet-20240620 */
  model: string;
  /** Default: https://api.anthropic.com */
  baseUrl?: string;
  /** Default: 2023-06-01 */
  anthropicVersion?: string;
};

export class AnthropicClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly anthropicVersion: string;

  constructor(opts: AnthropicClientOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.baseUrl = opts.baseUrl ?? 'https://api.anthropic.com';
    this.anthropicVersion = opts.anthropicVersion ?? '2023-06-01';
  }

  async createMessage(params: {
    system?: string;
    messages: AnthropicMessage[];
    maxTokens: number;
    temperature?: number;
  }): Promise<unknown> {
    const res = await fetch(this.baseUrl.replace(/\/$/, '') + '/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.anthropicVersion
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        system: params.system,
        messages: params.messages
      })
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Anthropic /v1/messages failed: ${res.status} ${res.statusText} ${t}`);
    }

    return res.json();
  }

  /**
   * Convenience: ask for a JSON-only response and parse it.
   * You should still validate the structure.
   */
  async createJson<T>(params: {
    system?: string;
    prompt: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<T> {
    const out = await this.createMessage({
      system: params.system,
      maxTokens: params.maxTokens ?? 800,
      temperature: params.temperature ?? 0,
      messages: [{ role: 'user', content: params.prompt }]
    });

    // Anthropic Messages API returns content blocks. We'll try to find the first text block.
    const anyOut = out as any;
    const blocks = anyOut?.content;
    const text =
      Array.isArray(blocks)
        ? blocks.find((b: any) => b?.type === 'text')?.text
        : undefined;

    if (typeof text !== 'string') {
      throw new Error('Anthropic response did not contain a text block');
    }

    // Strip common markdown fences.
    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    return JSON.parse(cleaned) as T;
  }
}
