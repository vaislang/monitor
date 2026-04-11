/**
 * Type declarations for .vaisx component files.
 * vite-plugin-vaisx transforms these into JS modules at build time.
 */

declare module "*.vaisx" {
  export interface VaisXComponent {
    /** Unique component id derived from filename */
    id: string;
    /** Render the component to an HTML string */
    render(props?: Record<string, unknown>): string;
  }

  const component: VaisXComponent;
  export default component;

  /** Compiled render function */
  export function __render__(props?: Record<string, unknown>): string;
}

/**
 * Type declarations for .vais server modules used in the web layer.
 * These are stubbed at build time by vite-plugin-vaisx.
 */
declare module "*.vais" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stub: any;
  export default stub;
  export const t: (key: string) => string;
}
