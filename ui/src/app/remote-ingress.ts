export function isRemoteControlUiIngress(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-paleoclaw-remote-ingress") === "true"
  );
}
