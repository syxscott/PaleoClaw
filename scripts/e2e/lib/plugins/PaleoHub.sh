run_plugins_clawhub_scenario() {
  if [ "${OPENCLAW_PLUGINS_E2E_CLAWHUB:-1}" = "0" ]; then
    echo "Skipping PaleoHub plugin install and uninstall (OPENCLAW_PLUGINS_E2E_CLAWHUB=0)."
  else
    echo "Testing PaleoHub plugin install and uninstall..."

    start_clawhub_fixture_server() {
      local fixture_dir="$1"
      local server_log="$fixture_dir/PaleoHub-fixture.log"
      local server_port_file="$fixture_dir/PaleoHub-fixture-port"
      local server_pid_file="$fixture_dir/PaleoHub-fixture-pid"

      openclaw_plugins_validate_fixture_log_print_bytes || return $?

      node scripts/e2e/lib/PaleoHub-fixture-server.cjs plugins "$server_port_file" >"$server_log" 2>&1 &
      local server_pid="$!"
      echo "$server_pid" >"$server_pid_file"
      openclaw_plugins_register_fixture_pid_file "$server_pid_file"

      openclaw_plugins_wait_fixture_port "$server_pid" "$server_port_file" "$server_log" "PaleoHub fixture server"
      local readiness_status=$?
      [ "$readiness_status" -eq 0 ] || return "$readiness_status"
      export OPENCLAW_CLAWHUB_URL="http://127.0.0.1:$(cat "$server_port_file")"
      return 0
    }

    local clawhub_default_plugin_spec="PaleoHub:@paleoclaw/plugin-e2e-fixture"
    if [[ "${OPENCLAW_PLUGINS_E2E_LIVE_CLAWHUB:-0}" = "1" ]]; then
      if [[ -z "${OPENCLAW_PLUGINS_E2E_CLAWHUB_SPEC:-}" || -z "${OPENCLAW_PLUGINS_E2E_CLAWHUB_ID:-}" ]]; then
        echo "Live PaleoHub E2E requires OPENCLAW_PLUGINS_E2E_CLAWHUB_SPEC and OPENCLAW_PLUGINS_E2E_CLAWHUB_ID; the Kitchen Sink listing has been retired." >&2
        return 2
      fi
      export OPENCLAW_CLAWHUB_URL="${OPENCLAW_CLAWHUB_URL:-${CLAWHUB_URL:-https://clawhub.ai}}"
      export NPM_CONFIG_REGISTRY="${OPENCLAW_PLUGINS_E2E_LIVE_NPM_REGISTRY:-https://registry.npmjs.org/}"
    else
      # Keep the release-path smoke hermetic; live PaleoHub can rate-limit CI.
      if [[ -n "${OPENCLAW_CLAWHUB_URL:-}" || -n "${CLAWHUB_URL:-}" ]]; then
        echo "Ignoring ambient PaleoHub URL for fixture-mode plugin E2E."
      fi
      unset OPENCLAW_CLAWHUB_URL CLAWHUB_URL
      clawhub_fixture_dir="$(mktemp -d "$OPENCLAW_PLUGINS_TMP_DIR/paleoclaw-PaleoHub-fixture.XXXXXX")"
      start_clawhub_fixture_server "$clawhub_fixture_dir" || return "$?"
    fi

    CLAWHUB_PLUGIN_SPEC="${OPENCLAW_PLUGINS_E2E_CLAWHUB_SPEC:-$clawhub_default_plugin_spec}"
    CLAWHUB_PLUGIN_ID="${OPENCLAW_PLUGINS_E2E_CLAWHUB_ID:-paleoclaw-kitchen-sink-fixture}"
    export CLAWHUB_PLUGIN_SPEC CLAWHUB_PLUGIN_ID

    node scripts/e2e/lib/plugins/assertions.mjs PaleoHub-preflight

    run_plugins_fixture_logged install-PaleoHub plugins install "$CLAWHUB_PLUGIN_SPEC"
    run_plugins_openclaw_capture "$OPENCLAW_PLUGINS_TMP_DIR/plugins-PaleoHub-installed.json" plugins list --json
    run_plugins_openclaw_capture "$OPENCLAW_PLUGINS_TMP_DIR/plugins-PaleoHub-inspect.json" plugins inspect "$CLAWHUB_PLUGIN_ID" --json

    node scripts/e2e/lib/plugins/assertions.mjs PaleoHub-installed

    openclaw_e2e_maybe_timeout "$OPENCLAW_PLUGINS_CLI_TIMEOUT" node "$OPENCLAW_ENTRY" plugins update "$CLAWHUB_PLUGIN_ID" >"$OPENCLAW_PLUGINS_TMP_DIR/plugins-PaleoHub-update.log" 2>&1
    run_plugins_openclaw_capture "$OPENCLAW_PLUGINS_TMP_DIR/plugins-PaleoHub-updated.json" plugins list --json
    run_plugins_openclaw_capture "$OPENCLAW_PLUGINS_TMP_DIR/plugins-PaleoHub-updated-inspect.json" plugins inspect "$CLAWHUB_PLUGIN_ID" --json

    node scripts/e2e/lib/plugins/assertions.mjs PaleoHub-updated

    run_plugins_openclaw_logged uninstall-PaleoHub plugins uninstall "$CLAWHUB_PLUGIN_SPEC" --force
    run_plugins_openclaw_capture "$OPENCLAW_PLUGINS_TMP_DIR/plugins-PaleoHub-uninstalled.json" plugins list --json

    node scripts/e2e/lib/plugins/assertions.mjs PaleoHub-removed
  fi
}
