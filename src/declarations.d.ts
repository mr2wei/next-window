/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
declare module '*.css';

type WinApiModule = typeof import('./util/win-api');

type PromisifyWinApi<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? K : never]: K extends `on${string}`
    ? T[K]
    : T[K] extends (...args: infer A) => infer R
      ? (...args: A) => Promise<Awaited<R>>
      : never;
};

interface Window {
  winApi: PromisifyWinApi<WinApiModule>;
}
