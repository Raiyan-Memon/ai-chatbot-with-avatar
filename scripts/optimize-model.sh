#!/usr/bin/env bash
# Rebuilds public/avatar-optimized.glb from public/avatar.vrm.
#
#   bash scripts/optimize-model.sh
#
# Three passes, in order:
#   resize  textures down to 1024 (they ship at 2048, far more than the avatar
#           is ever drawn at)
#   webp    re-encode from lossless PNG — this is where most of the size goes
#   prune   drop anything unreferenced, including the 2.1 MB VRM thumbnail that
#           only avatar hubs ever display
#
# The VRM extensions (VRMC_vrm, VRMC_springBone, VRMC_materials_mtoon) do not
# survive this — gltf-transform cannot parse them. That is fine while the app
# loads the model with a plain GLTFLoader, but it means avatar.vrm stays the
# source of truth. Adding @pixiv/three-vrm later would mean revisiting this.
#
# After running, confirm the blendshapes and bones the animation depends on are
# still present before shipping.
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="public/avatar.vrm"
OUT="public/avatar-optimized.glb"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

CLI="npx --yes @gltf-transform/cli@latest"

$CLI resize "$SRC" "$TMP/a.glb" --width 1024 --height 1024
$CLI webp "$TMP/a.glb" "$TMP/b.glb"
$CLI prune "$TMP/b.glb" "$OUT"

echo
echo "wrote $OUT"
ls -lh "$SRC" "$OUT" | awk '{print "  " $5 "\t" $9}'
