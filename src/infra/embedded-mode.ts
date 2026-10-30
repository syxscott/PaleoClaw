let embeddedModeValue = false;

/** Sets the process-local embedded-mode flag used by UI and hosted runtimes. */
export function setEmbeddedMode(value: boolean): void {
  embeddedModeValue = value;
}

/** Returns whether the current process is running inside an embedded paleoclaw host. */
export function isEmbeddedMode(): boolean {
  return embeddedModeValue;
}
