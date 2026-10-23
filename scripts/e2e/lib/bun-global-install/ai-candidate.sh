# Shared candidate AI override preparation; Node is allowed during this phase.
prepare_ai_candidate() {
  local package_tgz="${1:?missing package tarball}"
  local pack_dir="${2:?missing pack directory}"
  local ai_manifest
  local ai_package_dir
  local ai_tarballs
  local root_manifest

  root_manifest="$pack_dir/paleoclaw-package.json"
  tar -xOf "$package_tgz" package/package.json >"$root_manifest"
  if ! tar -tzf "$package_tgz" package/node_modules/@paleoclaw/ai/package.json >/dev/null 2>&1; then
    if node -e '
const manifest = require(process.argv[1]);
process.exit(manifest.dependencies?.["@paleoclaw/ai"] ? 0 : 1);
' "$root_manifest"; then
      if [ -z "${OPENCLAW_PREPUBLISH_PLUGIN_REGISTRY_DIR:-}" ]; then
        echo "paleoclaw tarball requires a verified candidate registry for unbundled @paleoclaw/ai" >&2
        exit 1
      fi
      REQUIRED_REGISTRY_PACKAGES='["@paleoclaw/ai"]'
      echo "==> Resolve candidate @paleoclaw/ai from the prepared package registry"
      return
    fi
    echo "==> Candidate has no bundled @paleoclaw/ai dependency"
    return
  fi
  echo "==> Extract bundled candidate @paleoclaw/ai package"
  ai_package_dir="$pack_dir/ai-candidate"
  mkdir -p "$ai_package_dir"
  tar -xzf "$package_tgz" \
    -C "$ai_package_dir" \
    --strip-components=4 \
    package/node_modules/@paleoclaw/ai
  ai_manifest="$ai_package_dir/package.json"
  node scripts/e2e/lib/bun-global-install/assertions.mjs \
    assert-release-versions \
    "$root_manifest" \
    "$ai_manifest" \
    >/dev/null
  npm pack --ignore-scripts --silent --pack-destination "$pack_dir" "$ai_package_dir" >/dev/null
  ai_tarballs=("$pack_dir"/paleoclaw-ai-*.tgz)
  if [ "${#ai_tarballs[@]}" -ne 1 ] || [ ! -f "${ai_tarballs[0]}" ]; then
    echo "expected one packed @paleoclaw/ai candidate in $pack_dir" >&2
    exit 1
  fi
  AI_PACKAGE_TGZ="${ai_tarballs[0]}"
}
