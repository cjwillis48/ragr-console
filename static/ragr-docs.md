# RAGr — RAG-as-a-Service

## What is RAGr?

RAGr is a RAG-as-a-Service platform that lets you build AI assistants powered by your own knowledge base. You upload your content — documents, URLs, text — and RAGr handles chunking, embedding, indexing, and retrieval. Your users get an AI assistant that answers questions grounded in your data, not generic training data.

## Who is RAGr for?

RAGr is built for developers and teams who want to add AI-powered Q&A to their products without building and maintaining a RAG pipeline themselves. Common use cases include:

- Customer support bots trained on your help docs
- Internal knowledge assistants for teams
- Product documentation chatbots embedded in your app
- Sales enablement tools grounded in your collateral

## How does it work?

1. **Create a model** — each model is an isolated AI assistant with its own knowledge base, personality, and configuration.
2. **Add sources** — upload files or point RAGr at URLs. We crawl, chunk, embed, and index your content automatically.
3. **Configure** — customize the system prompt, set token budgets, choose the LLM provider, and theme the chat widget to match your brand.
4. **Deploy** — embed the chat widget on your site with a single line of code, or integrate via our REST API.

## Key Features

### Multi-tenant isolation

Every model gets its own knowledge base, configuration, and conversation history. Your customers' data never crosses boundaries. Create as many models as you need for different use cases, clients, or environments.

### Managed RAG pipeline

You don't need to worry about chunking strategies, embedding models, or vector databases. Upload your content and RAGr handles the entire retrieval pipeline — from ingestion to search to response generation.

### Embeddable chat widget

Drop a fully themed chat widget into any website with a single line of code. The widget supports custom colors, fonts, welcome messages, and suggested questions. It works on any site — just paste the iframe embed code.

### REST API

For full control, use the RAGr API directly. It's a simple REST interface with server-sent events (SSE) for real-time streaming responses. No SDK required — integrate from any language or framework.

### Source management

Add content from multiple source types:

- **File uploads** — PDFs, text files, markdown, and more
- **URL crawling** — point RAGr at a URL and we'll crawl and index the content
- View how your content is chunked and indexed

### Usage tracking and budgets

Set token budgets per model to control costs. Monitor usage stats and review full conversation logs to understand how your AI assistants are being used.

### Conversation history

Every conversation is logged with full message history, token counts, and response metadata. Review conversations to understand user needs and improve your knowledge base.

### Reranking

RAGr supports reranking to improve retrieval quality. Retrieved chunks are re-scored for relevance before being sent to the LLM, so your assistant gives more accurate answers.

## Pricing

RAGr is currently in early access. Contact us for pricing information.

## Getting started

1. Sign up at ragr.dev
2. Create your first model in the admin console
3. Upload your content as sources
4. Embed the chat widget or integrate via API

## Technical details

- **Streaming responses** — real-time server-sent events (SSE) for instant-feeling answers
- **LLM flexibility** — configure which language model powers each assistant
- **System prompt control** — full control over your assistant's personality and behavior, with AI-assisted prompt generation
- **Custom theming** — match the chat widget to your brand with custom colors, fonts, and styling
- **API keys** — generate API keys for programmatic access to your models
- **Cloudflare deployment** — fast, global edge deployment
