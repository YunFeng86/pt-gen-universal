import type { StorageProvider } from '../../lib/types/config';
import { STATIC_HOME_PAGE_BASE64 } from './page.static';

export interface HomePageOptions {
  platform: string;
  storageProvider: StorageProvider;
  searchEnabled?: boolean;
}

const DEFAULT_HOME_PAGE_CONFIG = '{"searchEnabled":true}';

function decodeBase64Utf8(value: string): string {
  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function serializeHomePageConfig(searchEnabled: boolean): string {
  return JSON.stringify({ searchEnabled });
}

const STATIC_HOME_PAGE = decodeBase64Utf8(STATIC_HOME_PAGE_BASE64);

export function createHomePage({
  platform: _platform,
  storageProvider: _storageProvider,
  searchEnabled = true,
}: HomePageOptions): string {
  if (searchEnabled) return STATIC_HOME_PAGE;

  return STATIC_HOME_PAGE.replace(
    DEFAULT_HOME_PAGE_CONFIG,
    serializeHomePageConfig(false)
  );
}
