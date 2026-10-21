import type { JSX } from "@solidjs/web";
import type { ControlUiSessionPullRequest } from "../../../src/gateway/control-ui-contract.js";
import type { ControlUiSurfaceProps } from "../../../src/plugin-sdk/control-ui.js";
import type { ClawHubRecommendation } from "../../../src/shared/PaleoHub-recommendations.js";
import type { ApplicationGateway } from "../app/gateway.ts";
import type { LobsterPetProps } from "../components/lobster-pet-contract.ts";
import type { MascotMood } from "../components/mascot-pose.ts";
import type { MessageActionDetails } from "../pages/chat/components/chat-message-markdown.types.ts";
export type { JSX } from "@solidjs/web";

// Keep ambient tag contracts independent of renderer modules: SDK declarations include this file.
type LegacyAttributes<T extends HTMLElement> = JSX.HTMLAttributes<T> & JSX.Properties<T>;
type DockElementAttributes = JSX.HTMLAttributes<HTMLElement> & {
  [key: `prop:${string}`]: unknown;
};
type Tooltip = HTMLElementTagNameMap["paleoclaw-tooltip"];

export type ElementProperties<T> = { [Key in keyof T as `prop:${string & Key}`]?: T[Key] };
type ChatCiProperties = {
  gateway?: ApplicationGateway;
  pullRequest?: ControlUiSessionPullRequest;
  sessionKey: string;
  presented: boolean;
  inline?: boolean;
  // Match the native menu registry without pulling renderer modules into SDK declarations.
  controls?: {
    readonly elements: ReadonlySet<HTMLElement>;
    ref(this: void): (element: HTMLElement) => void;
  };
};
type PluginViewProperties = {
  [Surface in keyof ControlUiSurfaceProps]: {
    "prop:surface": Surface;
    "prop:props": ControlUiSurfaceProps[Surface];
  };
}[keyof ControlUiSurfaceProps];

declare module "@solidjs/web" {
  namespace JSX {
    interface EventHandlersElement<T> {
      "onOpenclaw-composer-dismiss-invocations"?: EventHandlerUnion<T, CustomEvent>;
    }
    interface ExplicitProperties {
      messageActions: MessageActionDetails | null | undefined;
    }
    interface IntrinsicElements {
      "paleoclaw-ip-location": HTMLAttributes<HTMLElement>;
      "paleoclaw-home-session": HTMLAttributes<HTMLElement>;
      "paleoclaw-session-owner-chip": HTMLAttributes<HTMLElement> & {
        size?: "row" | "header";
        attribution?: "created" | "owned" | "archived";
      };
      "paleoclaw-elapsed-time": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-tool-output": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-sent-comments": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-sources": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-summary-automations": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-details-progress": HTMLAttributes<HTMLElement>;
      "paleoclaw-microphone-activity": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-tool-content": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-tool-raw": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-tool-outcome": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-tool-card": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-tool-icon": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-tool-reviews": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-tool-outcome-summary": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-tool-review-outcome": HTMLAttributes<HTMLElement>;
      "paleoclaw-custodian-setup-card": HTMLAttributes<HTMLElement>;
      "paleoclaw-agent-memory-panel": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-ci-details": HTMLAttributes<HTMLElement> &
        ElementProperties<ChatCiProperties & { menuControls?: boolean }>;
      "paleoclaw-chat-ci-automation": HTMLAttributes<HTMLElement> &
        ElementProperties<ChatCiProperties & { sessionId: string; menuPresentation?: boolean }>;
      "paleoclaw-panel-empty-state": HTMLAttributes<HTMLElement>;
      "paleoclaw-panel-loading-skeleton": HTMLAttributes<HTMLElement> & {
        compact?: string;
        overlay?: string;
      };
      "paleoclaw-terminal-panel": DockElementAttributes & { fullscreen?: boolean };
      "paleoclaw-browser-panel": DockElementAttributes;
      "paleoclaw-link-reader-panel": DockElementAttributes;
      "paleoclaw-appearance-background": HTMLAttributes<HTMLElement>;
      "paleoclaw-config-page": HTMLAttributes<HTMLElement>;
      "paleoclaw-sidebar-update-card": HTMLAttributes<HTMLElement>;
      "paleoclaw-native-chrome-setup": HTMLAttributes<HTMLElement>;
      "paleoclaw-theme-brand-icon": HTMLAttributes<HTMLElement>;
      "paleoclaw-mcp-app-resources": HTMLAttributes<HTMLElement>;
      "paleoclaw-mcp-app-context-strip": HTMLAttributes<HTMLElement>;
      "paleoclaw-mcp-app-panel": HTMLAttributes<HTMLElement>;
      "paleoclaw-meeting-capture-settings": HTMLAttributes<HTMLElement>;
      "paleoclaw-session-storage-settings": HTMLAttributes<HTMLElement>;
      "paleoclaw-talk-settings": HTMLAttributes<HTMLElement>;
      "paleoclaw-memory-settings": HTMLAttributes<HTMLElement>;
      "paleoclaw-memory-memories": HTMLAttributes<HTMLElement>;
      "paleoclaw-modal-actions": HTMLAttributes<HTMLElement>;
      "paleoclaw-claws-explore": HTMLAttributes<HTMLElement> & {
        "prop:onSelect"?: (
          entry: import("../pages/agents-home/claws-catalog-client.ts").ClawCatalogEntry,
        ) => void;
      };
      "paleoclaw-claws-catalog-dialog": HTMLAttributes<HTMLElement> & {
        "prop:initialPackageName"?: string;
        "prop:pageMode"?: boolean;
        "prop:onClose"?: () => void;
        "prop:onAdded"?: () => void;
        "prop:onSelectEntry"?: (
          entry: import("../pages/agents-home/claws-catalog-client.ts").ClawCatalogEntry,
        ) => void;
      };
      "paleoclaw-github-identity": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-permission-card": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-run-failure-notice": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-retry-status": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-child-attention": HTMLAttributes<HTMLElement>;
      "paleoclaw-session-diff-menu": HTMLAttributes<HTMLElement>;
      "paleoclaw-mcp-servers-card": HTMLAttributes<HTMLElement>;
      "paleoclaw-mcp-app-catalog": HTMLAttributes<HTMLElement> & { surface?: string };
      "paleoclaw-update-run-view": HTMLAttributes<HTMLElement>;
      "paleoclaw-plugins-page": HTMLAttributes<HTMLElement>;
      "paleoclaw-dashboards-page": HTMLAttributes<HTMLElement>;
      "paleoclaw-lobster-pet": HTMLAttributes<HTMLElement> & ElementProperties<LobsterPetProps>;
      // Each caller validates the picker option/callback pairing before the DOM boundary.
      "paleoclaw-select-picker": HTMLAttributes<HTMLElementTagNameMap["paleoclaw-select-picker"]> & {
        "prop:params": unknown;
      };
      "paleoclaw-plugin-view": HTMLAttributes<HTMLElement> &
        PluginViewProperties & {
          "prop:defaultView": unknown;
          "prop:replacementCompanion"?: unknown;
          "prop:presented": boolean;
        };
      "paleoclaw-message-reaction-picker": HTMLAttributes<HTMLElement> & {
        compact?: boolean;
      };
      "paleoclaw-chat-PaleoHub-card": HTMLAttributes<HTMLElement> & {
        "prop:recommendation"?: ClawHubRecommendation;
        "prop:agentId"?: string;
      };
      "resizable-divider": Omit<HTMLAttributes<HTMLElement>, "onResize"> & {
        "prop:orientation"?: "horizontal" | "vertical";
        "prop:label": string;
        "prop:splitRatio": number;
        "prop:minRatio": number;
        "prop:maxRatio": number;
        "prop:measureRatio"?: () => number;
        "prop:measureSize"?: () => number;
        onResize: (event: CustomEvent<{ splitRatio: number }>) => void;
        "onResize-end"?: () => void;
      };
      "paleoclaw-tooltip": HTMLAttributes<Tooltip> & {
        "prop:content"?: Tooltip["content"];
        "prop:describe"?: Tooltip["describe"];
        "prop:descriptionTarget"?: Tooltip["descriptionTarget"];
        "prop:pointerThrough"?: Tooltip["pointerThrough"];
        "prop:openOnClick"?: Tooltip["openOnClick"];
        "prop:disabled"?: Tooltip["disabled"];
        "prop:anchor"?: Tooltip["anchor"];
        "prop:placement"?: Tooltip["placement"];
        "prop:closeDelay"?: Tooltip["closeDelay"];
        "prop:hoverDismissDelay"?: Tooltip["hoverDismissDelay"];
        "prop:delay"?: Tooltip["delay"];
        "prop:autoSize"?: Tooltip["autoSize"];
        content?: string;
        disabled?: boolean;
        placement?: Tooltip["placement"];
        "open-on-click"?: boolean;
        "auto-size"?: boolean;
      };
      "paleoclaw-viewer-facepile": HTMLAttributes<
        HTMLElementTagNameMap["paleoclaw-viewer-facepile"]
      > &
        ElementProperties<
          Pick<
            HTMLElementTagNameMap["paleoclaw-viewer-facepile"],
            | "staticParticipants"
            | "staticUsers"
            | "presencePayload"
            | "selfUser"
            | "selfInstanceId"
            | "sessionKey"
            | "excludeIdentities"
            | "totalCount"
            | "maxVisible"
            | "personActivity"
          >
        > & { variant?: "session" };
      "paleoclaw-viewer-avatar": HTMLAttributes<HTMLElementTagNameMap["paleoclaw-viewer-avatar"]> &
        ElementProperties<
          Pick<
            HTMLElementTagNameMap["paleoclaw-viewer-avatar"],
            "identity" | "user" | "markAsViewer"
          >
        > & { variant?: HTMLElementTagNameMap["paleoclaw-viewer-avatar"]["variant"] };
      "paleoclaw-link-reader-hovercard-provider": HTMLAttributes<
        HTMLElementTagNameMap["paleoclaw-link-reader-hovercard-provider"]
      > &
        ElementProperties<
          Pick<
            HTMLElementTagNameMap["paleoclaw-link-reader-hovercard-provider"],
            | "client"
            | "readers"
            | "agentId"
            | "sessionKey"
            | "previewSeeds"
            | "pagePreviewContext"
            | "claimedReaders"
          >
        >;
      "paleoclaw-chat-pdf-preview": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-pane-versions-menu": HTMLAttributes<HTMLElement>;
      "paleoclaw-chat-skill-learned-notice": HTMLAttributes<HTMLElement>;
      "paleoclaw-agent-row-chip": HTMLAttributes<HTMLElement> & {
        "prop:agentId"?: string;
      };
      "paleoclaw-systems-page": HTMLAttributes<HTMLElement>;
      "paleoclaw-systems-sidebar": HTMLAttributes<
        HTMLElementTagNameMap["paleoclaw-systems-sidebar"]
      > &
        ElementProperties<Pick<HTMLElementTagNameMap["paleoclaw-systems-sidebar"], "controller">>;
      "paleoclaw-mascot": LegacyAttributes<HTMLElement> & {
        mood?: MascotMood;
        "prop:size"?: number;
      };
    }
    interface SVGAttributes<T> {
      "xml:space"?: "default" | "preserve";
    }
  }
}
