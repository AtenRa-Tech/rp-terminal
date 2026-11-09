#!/usr/bin/env bash
# A depth=1 clone (Actions default checkout) makes merge-base --is-ancestor fail
# when pages-tested is simply not present. The old promote recipe treated that as
# "not an ancestor" and skipped the tag move (CI 42284938862). The new recipe
# must fetch enough history that a genuine ancestor is recognized.
set -euo pipefail
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

src="$tmp/src"
git init -q -b main "$src"
git -C "$src" config user.name t
git -C "$src" config user.email t@t
echo 1 > "$src/f" && git -C "$src" add f && git -C "$src" commit -q -m A
A=$(git -C "$src" rev-parse HEAD)
echo 2 > "$src/f" && git -C "$src" add f && git -C "$src" commit -q -m B
echo 3 > "$src/f" && git -C "$src" add f && git -C "$src" commit -q -m C
C=$(git -C "$src" rev-parse HEAD)
git -C "$src" tag pages-tested "$A"

bare="$tmp/bare.git"
git clone -q --bare "$src" "$bare"

# --- old recipe on a depth=1 clone: the ancestry check lies ---
old="$tmp/old"
git clone -q --depth=1 "file://$bare" "$old"
git -C "$old" fetch -q origin main --tags || true
ocur=$(git -C "$old" rev-parse -q --verify refs/tags/pages-tested || true)
if [ -n "$ocur" ] && git -C "$old" merge-base --is-ancestor "$ocur" "$C" 2>/dev/null; then
  echo "FAIL old recipe: depth=1 unexpectedly treated $ocur as an ancestor of $C"
  exit 1
fi
echo "PASS old recipe lies: depth=1 does not treat pages-tested $A as an ancestor of $C"

# --- new recipe from ci.yml promote: unshallow, then fetch the tag and main ---
new="$tmp/new"
git clone -q --depth=1 "file://$bare" "$new"
git -C "$new" fetch -q --unshallow origin 2>/dev/null || true
git -C "$new" fetch -q origin '+refs/tags/pages-tested:refs/tags/pages-tested' main
ncur=$(git -C "$new" rev-parse -q --verify refs/tags/pages-tested || true)
if [ -z "$ncur" ]; then echo "FAIL new recipe: tag missing after fetch"; exit 1; fi
if ! git -C "$new" cat-file -e "$ncur^{commit}" 2>/dev/null; then
  echo "FAIL new recipe: tag commit missing after fetch"; exit 1
fi
if ! git -C "$new" merge-base --is-ancestor "$ncur" "$C"; then
  echo "FAIL new recipe: $ncur is not an ancestor of $C after fetch"; exit 1
fi
if [ "$ncur" != "$A" ]; then
  echo "FAIL new recipe: tag resolved to $ncur, expected $A"; exit 1
fi
echo "PASS new recipe: pages-tested $ncur is an ancestor of $C"
