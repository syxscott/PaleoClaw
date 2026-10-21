import { createComponent } from "solid-js";
import { defineSolidBridge } from "../../lib/solid-bridge.ts";
import { BrowserDocumentContent, type BrowserDocumentViewProps } from "./browser-document.tsx";

export { BrowserDocumentContent } from "./browser-document.tsx";

export type BrowserDocumentProps = BrowserDocumentViewProps;

declare global {
  interface HTMLElementTagNameMap {
    "paleoclaw-browser-document": HTMLElement & {
      props: BrowserDocumentProps | null;
    };
  }
}

if (!customElements.get("paleoclaw-browser-document")) {
  defineSolidBridge<{ props: BrowserDocumentProps | null }>(
    "paleoclaw-browser-document",
    (props, host) => {
      host.style.display = "contents";
      return createComponent(BrowserDocumentContent, {
        get value() {
          return props.props;
        },
      });
    },
    { properties: { props: { default: null, attribute: false } } },
  );
}
