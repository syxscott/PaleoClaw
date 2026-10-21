import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import type { ControlUiEnvironment } from "../../../src/gateway/control-ui-bootstrap-contract.js";
import { beginNativeWindowDrag } from "../app/native-window-drag.ts";
import { NAV_DRAWER_TOGGLE_REGISTRATION } from "../app/navigation-surface.ts";
import { controlUiPublicAssetPath } from "../app/public-assets.ts";
import { createRouteElementRef } from "../app/route-element-ref.ts";
import { t } from "../lib/reactive/i18n.ts";
import { defineSolidBridge } from "../lib/solid-bridge.ts";
import type { GatewayStatusProps } from "./gateway-status.ts";
import { GatewayStatus } from "./solid/gateway-status.tsx";
import { Icon } from "./solid/icon.tsx";
import { Kbd, ShortcutText } from "./solid/kbd.tsx";
import "./tooltip.ts";

type Props = {
  navDrawerOpen: boolean;
  gatewayStatus?: GatewayStatusProps | null;
  newSessionAction: (() => JSX.Element) | undefined;
  resourceBasePath: string;
  environment: ControlUiEnvironment | null;
  onToggleDrawer: ((trigger: HTMLElement) => void) | undefined;
  onOpenPalette: (() => void) | undefined;
};

/** Narrow-viewport header; the desktop sidebar owns navigation. */
defineSolidBridge<Props>(
  "paleoclaw-app-topbar",
  (props, host) => {
    host.style.display = "contents";
    const drawerRef = createRouteElementRef(NAV_DRAWER_TOGGLE_REGISTRATION);
    const drawerLabel = () => (props.navDrawerOpen ? t("nav.collapse") : t("nav.expand"));
    return (
      <header class="topbar">
        <div class="topnav-shell">
          <paleoclaw-tooltip prop:content={drawerLabel()}>
            <button
              type="button"
              ref={drawerRef}
              class="topbar-icon-btn topbar-nav-toggle"
              onClick={(event) => props.onToggleDrawer?.(event.currentTarget)}
              aria-label={drawerLabel()}
              aria-expanded={props.navDrawerOpen ? "true" : "false"}
              data-connection-status={props.gatewayStatus?.kind ?? undefined}
            >
              <span class="nav-collapse-toggle__icon" aria-hidden="true">
                <Icon name="menu" />
              </span>
              <Show when={props.gatewayStatus?.kind}>
                <span class="gateway-status-dot" aria-hidden="true" />
              </Show>
            </button>
          </paleoclaw-tooltip>
          <div class="topnav-shell__content" onMouseDown={beginNativeWindowDrag}>
            <Show when={props.gatewayStatus?.kind && props.gatewayStatus.kind !== "connected"}>
              <div class="mobile-connection-status">
                <GatewayStatus {...props.gatewayStatus!} />
              </div>
            </Show>
            <div class="topbar-brand" aria-label="paleoclaw">
              <img
                class="topbar-brand__logo"
                src={controlUiPublicAssetPath("apple-touch-icon.png", props.resourceBasePath)}
                loading="lazy"
                alt=""
                aria-hidden="true"
              />
              <span class="topbar-brand__title">paleoclaw</span>
              <Show when={props.environment}>
                {(environment) => (
                  <span class="control-ui-environment-pill">{environment().label}</span>
                )}
              </Show>
            </div>
          </div>
          <div class="topnav-shell__actions">
            {props.newSessionAction?.()}
            <paleoclaw-tooltip prop:content={t("chat.commandPaletteTitle")}>
              <span slot="content">
                <ShortcutText
                  text={t("chat.commandPaletteTitle").replace("⌘K", "{shortcut}")}
                  shortcut={() => <Kbd keys={["⌘", "K"]} inline />}
                />
              </span>
              <button
                class="topbar-search"
                onClick={() => props.onOpenPalette?.()}
                aria-label={t("chat.openCommandPalette")}
              >
                <Icon name="search" />
              </button>
            </paleoclaw-tooltip>
          </div>
        </div>
      </header>
    );
  },
  {
    properties: {
      navDrawerOpen: { default: false, attribute: false },
      gatewayStatus: { default: null, attribute: false },
      newSessionAction: { default: undefined, attribute: false },
      resourceBasePath: { default: "", attribute: false },
      environment: { default: null, attribute: false },
      onToggleDrawer: { default: undefined, attribute: false },
      onOpenPalette: { default: undefined, attribute: false },
    },
  },
);
