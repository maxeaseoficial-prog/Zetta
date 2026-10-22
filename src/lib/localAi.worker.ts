import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

// This module is instantiated only by the explicit local-AI activation action.
const handler = new WebWorkerMLCEngineHandler()
self.onmessage = (event: MessageEvent) => handler.onmessage(event)
