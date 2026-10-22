#!/bin/sh
set -eu

root=$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/paleoclaw-facetime-uninstall-test.XXXXXX")
cleanup() { /bin/rm -rf "$root"; }
trap cleanup EXIT
home="$root/home"
tmp="$root/tmp"
/bin/mkdir -p \
  "$home/Library/Caches/paleoclaw/FaceTime/driver/OpenClawBridge.driver" \
  "$home/Library/Application Support/paleoclaw/FaceTime" \
  "$home/Library/Containers/com.apple.FaceTime/Data/tmp" \
  "$home/Library/Containers/com.apple.mobilephone/Data/tmp" \
  "$tmp/paleoclaw-facetime-macabi"
/usr/bin/touch \
  "$home/Library/Application Support/paleoclaw/FaceTime/helper-ipc-key" \
  "$home/Library/Application Support/paleoclaw/FaceTime/helper-build.sha256" \
  "$home/Library/Containers/com.apple.FaceTime/Data/tmp/FaceTimeHelper.dylib" \
  "$home/Library/Containers/com.apple.mobilephone/Data/tmp/FaceTimeHelper-1.dylib" \
  "$home/Library/Containers/com.apple.FaceTime/Data/tmp/unrelated" \
  "$tmp/paleoclaw-facetime-macabi/FaceTimeHelper.dylib"

/bin/sh "$(dirname "$0")/remove-user-artifacts.sh" "$home" "$tmp"
test ! -e "$home/Library/Caches/paleoclaw/FaceTime/driver/OpenClawBridge.driver"
test ! -e "$home/Library/Application Support/paleoclaw/FaceTime/helper-ipc-key"
test ! -e "$home/Library/Application Support/paleoclaw/FaceTime/helper-build.sha256"
test ! -e "$home/Library/Containers/com.apple.FaceTime/Data/tmp/FaceTimeHelper.dylib"
test ! -e "$home/Library/Containers/com.apple.mobilephone/Data/tmp/FaceTimeHelper-1.dylib"
test ! -e "$tmp/paleoclaw-facetime-macabi"
test -e "$home/Library/Containers/com.apple.FaceTime/Data/tmp/unrelated"
