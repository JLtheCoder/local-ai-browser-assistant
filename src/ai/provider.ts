import { chromeProvider } from './chrome';
import type { AIProvider } from './types';

// Registry of available providers. The UI only ever talks to the `AIProvider`
// interface, so swapping the backend (e.g. a local llama.cpp server later) means
// adding an implementation here and returning it from `getProvider`/`getDefaultProvider`.
const providers: AIProvider[] = [chromeProvider];

export function listProviders(): AIProvider[] {
  return providers;
}

export function getProvider(id?: string): AIProvider {
  if (!id) return chromeProvider;
  return providers.find((p) => p.id === id) ?? chromeProvider;
}

export function getDefaultProvider(): AIProvider {
  return chromeProvider;
}
