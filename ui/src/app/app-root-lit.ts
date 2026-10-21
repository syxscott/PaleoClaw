import type { JSX as SolidJSX } from "@solidjs/web";
import { listen } from "../lib/reactive/listener.ts";
import { isNativeWebChromeHost } from "./native-web-chrome.ts";

type RootElementAttributes = SolidJSX.HTMLAttributes<HTMLElement> & {
  [key: `prop:${string}`]: unknown;
};
declare module "@solidjs/web" {
  namespace JSX {
    interface IntrinsicElements {
      "paleoclaw-tooltip-provider": RootElementAttributes;
      "paleoclaw-gateway-url-confirmation": RootElementAttributes;
      "paleoclaw-browser-document": RootElementAttributes;
      "paleoclaw-board-document": RootElementAttributes;
      "paleoclaw-login-gate": RootElementAttributes;
      "paleoclaw-approval-page": RootElementAttributes;
      "paleoclaw-question-page": RootElementAttributes;
      "paleoclaw-session-progress-hovercard-provider": RootElementAttributes;
    }
  }
}

/** Keep focus on the same button when the unported document rerenders its label. */
export function createLegacyFocusEscape(close: () => void): (label: string) => HTMLElement | null {
  let button: HTMLButtonElement | undefined;
  return (label) => {
    if (isNativeWebChromeHost()) {
      return null;
    }
    if (!button) {
      button = document.createElement("button");
      button.className = "btn btn--ghost";
      button.type = "button";
      listen(button, "click", close);
    }
    button.textContent = label;
    return button;
  };
}
