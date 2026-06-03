#!/usr/bin/env bash
#
# Build pi binaries for all platforms locally.
# Mirrors .github/workflows/build-binaries.yml
#
# Usage:
<<<<<<< HEAD
#   ./scripts/build-binaries.sh [--skip-deps] [--platform <platform>]
#
# Options:
#   --skip-deps         Skip installing cross-platform dependencies
#   --platform <name>   Build only for specified platform (darwin-arm64, darwin-x64, linux-x64, linux-arm64, windows-x64, windows-arm64)
=======
#   ./scripts/build-binaries.sh [--skip-install] [--skip-deps] [--skip-build] [--platform <platform>] [--out <dir>]
#
# Options:
#   --skip-install      Skip npm ci
#   --skip-deps         Skip installing cross-platform dependencies
#   --skip-build        Skip npm run build
#   --platform <name>   Build only for specified platform (darwin-arm64, darwin-x64, linux-x64, linux-arm64, windows-x64, windows-arm64)
#   --out <dir>         Output directory (default: packages/coding-agent/binaries)
>>>>>>> upstream/main
#
# Output:
#   packages/coding-agent/binaries/
#     pi-darwin-arm64.tar.gz
#     pi-darwin-x64.tar.gz
#     pi-linux-x64.tar.gz
#     pi-linux-arm64.tar.gz
#     pi-windows-x64.zip
#     pi-windows-arm64.zip

set -euo pipefail

<<<<<<< HEAD
# Resolve to the repository root before doing anything else. This script
# lives at `scripts/build-binaries.sh`, so `..` is the repo root. If the
# script is ever moved to a deeper subdirectory (e.g. `scripts/release/`)
# this relative path must be updated; the assertion below catches that
# mistake immediately instead of letting `npm ci` fail with a confusing
# "ENOENT package.json" error inside the wrong directory.
cd "$(dirname "$0")/.."

if [[ ! -f package.json ]]; then
    echo "build-binaries.sh: expected to run from the repo root, but no" >&2
    echo "  package.json was found in $(pwd)." >&2
    echo "  Check the 'cd' near the top of this script — if the script" >&2
    echo "  was moved into a deeper directory, update the relative path." >&2
    exit 1
fi

SKIP_DEPS=false
PLATFORM=""

while [[ $# -gt 0 ]]; do
    case $1 in
=======
cd "$(dirname "$0")/.."

SKIP_INSTALL=false
SKIP_DEPS=false
SKIP_BUILD=false
PLATFORM=""
OUTPUT_DIR=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-install)
            SKIP_INSTALL=true
            shift
            ;;
>>>>>>> upstream/main
        --skip-deps)
            SKIP_DEPS=true
            shift
            ;;
<<<<<<< HEAD
=======
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
>>>>>>> upstream/main
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
<<<<<<< HEAD
=======
        --out)
            OUTPUT_DIR="$2"
            shift 2
            ;;
>>>>>>> upstream/main
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate platform if specified
if [[ -n "$PLATFORM" ]]; then
    case "$PLATFORM" in
        darwin-arm64|darwin-x64|linux-x64|linux-arm64|windows-x64|windows-arm64)
            ;;
        *)
            echo "Invalid platform: $PLATFORM"
            echo "Valid platforms: darwin-arm64, darwin-x64, linux-x64, linux-arm64, windows-x64, windows-arm64"
            exit 1
            ;;
    esac
fi

<<<<<<< HEAD
echo "==> Installing dependencies..."
npm ci

if [[ "$SKIP_DEPS" == "false" ]]; then
    echo "==> Installing cross-platform native bindings..."
    # npm ci only installs optional deps for the current platform
    # We need all platform bindings for bun cross-compilation
    # Use --force to bypass platform checks (os/cpu restrictions in package.json)
    # Install all in one command to avoid npm removing packages from previous installs
    npm install --no-save --force --ignore-scripts \
        @mariozechner/clipboard-darwin-arm64@0.3.2 \
        @mariozechner/clipboard-darwin-x64@0.3.2 \
        @mariozechner/clipboard-linux-x64-gnu@0.3.2 \
        @mariozechner/clipboard-linux-arm64-gnu@0.3.2 \
        @mariozechner/clipboard-win32-x64-msvc@0.3.2 \
        @mariozechner/clipboard-win32-arm64-msvc@0.3.2 \
        @img/sharp-darwin-arm64@0.34.5 \
        @img/sharp-darwin-x64@0.34.5 \
        @img/sharp-linux-x64@0.34.5 \
        @img/sharp-linux-arm64@0.34.5 \
        @img/sharp-win32-x64@0.34.5 \
        @img/sharp-win32-arm64@0.34.5 \
        @img/sharp-libvips-darwin-arm64@1.2.4 \
        @img/sharp-libvips-darwin-x64@1.2.4 \
        @img/sharp-libvips-linux-x64@1.2.4 \
        @img/sharp-libvips-linux-arm64@1.2.4
=======
if [[ -z "$OUTPUT_DIR" ]]; then
    OUTPUT_DIR="packages/coding-agent/binaries"
fi
if [[ "$OUTPUT_DIR" != /* ]]; then
    OUTPUT_DIR="$(pwd)/$OUTPUT_DIR"
fi

if [[ "$SKIP_INSTALL" == "false" ]]; then
    echo "==> Installing dependencies..."
    npm ci --ignore-scripts
else
    echo "==> Skipping npm ci (--skip-install)"
fi

if [[ "$SKIP_DEPS" == "false" ]]; then
    echo "==> Installing cross-platform native bindings..."
    CLIPBOARD_VERSION=$(node -p "require('./packages/coding-agent/package.json').optionalDependencies['@mariozechner/clipboard']")
    # npm ci only installs optional deps for the current platform
    # We need the base clipboard package and all platform bindings for bun cross-compilation
    # Use --force to bypass platform checks (os/cpu restrictions in package.json)
    # Install all in one command to avoid npm removing packages from previous installs
    npm install --include=optional --no-save --package-lock=false --force --ignore-scripts --min-release-age=0 \
        @mariozechner/clipboard@"$CLIPBOARD_VERSION" \
        @mariozechner/clipboard-darwin-arm64@"$CLIPBOARD_VERSION" \
        @mariozechner/clipboard-darwin-x64@"$CLIPBOARD_VERSION" \
        @mariozechner/clipboard-linux-x64-gnu@"$CLIPBOARD_VERSION" \
        @mariozechner/clipboard-linux-arm64-gnu@"$CLIPBOARD_VERSION" \
        @mariozechner/clipboard-win32-x64-msvc@"$CLIPBOARD_VERSION" \
        @mariozechner/clipboard-win32-arm64-msvc@"$CLIPBOARD_VERSION"
>>>>>>> upstream/main
else
    echo "==> Skipping cross-platform native bindings (--skip-deps)"
fi

<<<<<<< HEAD
echo "==> Building all packages..."
npm run build
=======
if [[ "$SKIP_BUILD" == "false" ]]; then
    echo "==> Building all packages..."
    npm run build
else
    echo "==> Skipping package build (--skip-build)"
fi
>>>>>>> upstream/main

echo "==> Building binaries..."
cd packages/coding-agent

# Clean previous builds
<<<<<<< HEAD
rm -rf binaries
mkdir -p binaries/{darwin-arm64,darwin-x64,linux-x64,linux-arm64,windows-x64,windows-arm64}
=======
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"/{darwin-arm64,darwin-x64,linux-x64,linux-arm64,windows-x64,windows-arm64}
>>>>>>> upstream/main

# Determine which platforms to build
if [[ -n "$PLATFORM" ]]; then
    PLATFORMS=("$PLATFORM")
else
    PLATFORMS=(darwin-arm64 darwin-x64 linux-x64 linux-arm64 windows-x64 windows-arm64)
fi

for platform in "${PLATFORMS[@]}"; do
    echo "Building for $platform..."
<<<<<<< HEAD
    # Externalize koffi to avoid embedding all 18 platform .node files (~74MB)
    # into every binary. Koffi is only used on Windows for VT input and the
    # call site has a try/catch fallback. For Windows builds, we copy the
    # appropriate .node file alongside the binary below.
    if [[ "$platform" == windows-* ]]; then
        bun build --compile --external koffi --target=bun-$platform ./dist/bun/cli.js --outfile binaries/$platform/pi.exe
    else
        bun build --compile --external koffi --target=bun-$platform ./dist/bun/cli.js --outfile binaries/$platform/pi
=======
    # Bun compiled executables only embed worker scripts when they are passed as
    # explicit build entrypoints. The runtime can still use new URL(...), but the
    # worker must be present in the compiled executable.
    if [[ "$platform" == windows-* ]]; then
        bun build --compile --target=bun-$platform ./dist/bun/cli.js ./src/utils/image-resize-worker.ts --outfile "$OUTPUT_DIR/$platform/pi.exe"
    else
        bun build --compile --target=bun-$platform ./dist/bun/cli.js ./src/utils/image-resize-worker.ts --outfile "$OUTPUT_DIR/$platform/pi"
        if [[ "$platform" == darwin-* ]] && command -v codesign >/dev/null 2>&1; then
            codesign --remove-signature "$OUTPUT_DIR/$platform/pi" 2>/dev/null || true
            codesign --force --sign - "$OUTPUT_DIR/$platform/pi"
        fi
>>>>>>> upstream/main
    fi
done

echo "==> Creating release archives..."

# Copy shared files to each platform directory
for platform in "${PLATFORMS[@]}"; do
<<<<<<< HEAD
    cp package.json binaries/$platform/
    cp README.md binaries/$platform/
    cp CHANGELOG.md binaries/$platform/
    cp ../../node_modules/@silvia-odwyer/photon-node/photon_rs_bg.wasm binaries/$platform/
    mkdir -p binaries/$platform/theme
    cp dist/modes/interactive/theme/*.json binaries/$platform/theme/
    mkdir -p binaries/$platform/assets
    cp dist/modes/interactive/assets/* binaries/$platform/assets/
    cp -r dist/core/export-html binaries/$platform/
    cp -r docs binaries/$platform/
    cp -r examples binaries/$platform/

    # Copy koffi native module for Windows (needed for VT input support)
    if [[ "$platform" == windows-* ]]; then
        if [[ "$platform" == "windows-arm64" ]]; then
            koffi_arch_dir="win32_arm64"
        else
            koffi_arch_dir="win32_x64"
        fi
        mkdir -p binaries/$platform/node_modules/koffi/build/koffi/$koffi_arch_dir
        cp ../../node_modules/koffi/index.js binaries/$platform/node_modules/koffi/
        cp ../../node_modules/koffi/package.json binaries/$platform/node_modules/koffi/
        cp ../../node_modules/koffi/build/koffi/$koffi_arch_dir/koffi.node binaries/$platform/node_modules/koffi/build/koffi/$koffi_arch_dir/
=======
    cp package.json "$OUTPUT_DIR/$platform/"
    cp README.md "$OUTPUT_DIR/$platform/"
    cp CHANGELOG.md "$OUTPUT_DIR/$platform/"
    cp ../../node_modules/@silvia-odwyer/photon-node/photon_rs_bg.wasm "$OUTPUT_DIR/$platform/"
    mkdir -p "$OUTPUT_DIR/$platform/theme"
    cp dist/modes/interactive/theme/*.json "$OUTPUT_DIR/$platform/theme/"
    mkdir -p "$OUTPUT_DIR/$platform/assets"
    cp dist/modes/interactive/assets/* "$OUTPUT_DIR/$platform/assets/"
    cp -r dist/core/export-html "$OUTPUT_DIR/$platform/"
    cp -r docs "$OUTPUT_DIR/$platform/"
    cp -r examples "$OUTPUT_DIR/$platform/"

    case "$platform" in
        darwin-arm64)
            clipboard_native_package="clipboard-darwin-arm64"
            ;;
        darwin-x64)
            clipboard_native_package="clipboard-darwin-x64"
            ;;
        linux-x64)
            clipboard_native_package="clipboard-linux-x64-gnu"
            ;;
        linux-arm64)
            clipboard_native_package="clipboard-linux-arm64-gnu"
            ;;
        windows-x64)
            clipboard_native_package="clipboard-win32-x64-msvc"
            ;;
        windows-arm64)
            clipboard_native_package="clipboard-win32-arm64-msvc"
            ;;
    esac
    mkdir -p "$OUTPUT_DIR/$platform/node_modules/@mariozechner"
    cp -r ../../node_modules/@mariozechner/clipboard "$OUTPUT_DIR/$platform/node_modules/@mariozechner/"
    cp -r ../../node_modules/@mariozechner/$clipboard_native_package "$OUTPUT_DIR/$platform/node_modules/@mariozechner/"

    # Copy terminal input native helpers next to compiled binaries.
    if [[ "$platform" == darwin-* ]]; then
        mkdir -p "$OUTPUT_DIR/$platform/native/darwin/prebuilds/$platform"
        cp ../tui/native/darwin/prebuilds/$platform/darwin-modifiers.node "$OUTPUT_DIR/$platform/native/darwin/prebuilds/$platform/"
    fi
    if [[ "$platform" == windows-* ]]; then
        if [[ "$platform" == "windows-arm64" ]]; then
            win32_arch_dir="win32-arm64"
        else
            win32_arch_dir="win32-x64"
        fi
        mkdir -p "$OUTPUT_DIR/$platform/native/win32/prebuilds/$win32_arch_dir"
        cp ../tui/native/win32/prebuilds/$win32_arch_dir/win32-console-mode.node "$OUTPUT_DIR/$platform/native/win32/prebuilds/$win32_arch_dir/"
>>>>>>> upstream/main
    fi
done

# Create archives
<<<<<<< HEAD
cd binaries
=======
cd "$OUTPUT_DIR"
>>>>>>> upstream/main

for platform in "${PLATFORMS[@]}"; do
    if [[ "$platform" == windows-* ]]; then
        # Windows (zip)
        echo "Creating pi-$platform.zip..."
<<<<<<< HEAD
        (cd $platform && zip -r ../pi-$platform.zip .)
    else
        # Unix platforms (tar.gz) - use wrapper directory for mise compatibility
        echo "Creating pi-$platform.tar.gz..."
        mv $platform pi && tar -czf pi-$platform.tar.gz pi && mv pi $platform
=======
        (cd "$platform" && zip -r ../pi-$platform.zip .)
    else
        # Unix platforms (tar.gz) - use wrapper directory for mise compatibility
        echo "Creating pi-$platform.tar.gz..."
        mv "$platform" pi && tar -czf pi-$platform.tar.gz pi && mv pi "$platform"
>>>>>>> upstream/main
    fi
done

# Extract archives for easy local testing
echo "==> Extracting archives for testing..."
for platform in "${PLATFORMS[@]}"; do
<<<<<<< HEAD
    rm -rf $platform
    if [[ "$platform" == windows-* ]]; then
        mkdir -p $platform && (cd $platform && unzip -q ../pi-$platform.zip)
    else
        tar -xzf pi-$platform.tar.gz && mv pi $platform
=======
    rm -rf "$platform"
    if [[ "$platform" == windows-* ]]; then
        mkdir -p "$platform" && (cd "$platform" && unzip -q ../pi-$platform.zip)
    else
        tar -xzf pi-$platform.tar.gz && mv pi "$platform"
>>>>>>> upstream/main
    fi
done

echo ""
echo "==> Build complete!"
<<<<<<< HEAD
echo "Archives available in packages/coding-agent/binaries/"
=======
echo "Archives available in $OUTPUT_DIR/"
>>>>>>> upstream/main
ls -lh *.tar.gz *.zip 2>/dev/null || true
echo ""
echo "Extracted directories for testing:"
for platform in "${PLATFORMS[@]}"; do
    if [[ "$platform" == windows-* ]]; then
<<<<<<< HEAD
        echo "  binaries/$platform/pi.exe"
    else
        echo "  binaries/$platform/pi"
=======
        echo "  $OUTPUT_DIR/$platform/pi.exe"
    else
        echo "  $OUTPUT_DIR/$platform/pi"
>>>>>>> upstream/main
    fi
done
