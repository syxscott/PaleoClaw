/** The source manifest owns publication eligibility, including bundled-only deferral. */
export function isPluginPublicationEnabled(packageJson, target) {
  return (
    packageJson.paleoclaw?.build?.bundledDist !== true &&
    (target === "npm"
      ? packageJson.paleoclaw?.release?.publishToNpm === true
      : packageJson.paleoclaw?.release?.publishToClawHub === true)
  );
}
