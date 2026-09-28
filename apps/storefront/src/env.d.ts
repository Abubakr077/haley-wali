/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_CATALOG_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    publishedArticles?: Promise<import("./lib/types").Product[]>;
  }
}
