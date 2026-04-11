/**
 * main.ts — VaisX Monitor app entry point
 *
 * Bootstraps the root component (layout.vaisx) into #app.
 * The .vaisx components are transformed by vite-plugin-vaisx at build time.
 */

import Layout from "./layout.vaisx";

const root = document.getElementById("app");
if (!root) {
  throw new Error("[monitor] #app element not found in DOM");
}

// Mount the root layout component
// vite-plugin-vaisx exposes { id, render } — render() returns an HTML string
// In production this would be replaced by a proper reactive runtime.
const html = Layout.render({});
root.innerHTML = html;

// Expose router globally (expected by layout.vaisx)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = window as unknown as Record<string, any>;
if (typeof win["router"] === "undefined") {
  win["router"] = {
    navigate(path: string) {
      window.history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
  };
}
