#!/bin/bash
# يبني rafidain-ios.ipa (غير موقّع رسمياً) على ماك في GitHub Actions — بلا مشروع Xcode
# المدخلات: ios/www (index.html + fonts/ + voice/*.m4a) تجهّزها بناية أندرويد
# الاستعمال: bash ios/build_ipa.sh <رقم البناية>
set -euo pipefail
NUM="${1:-1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/ios/build"
APP="$OUT/Payload/Rafidain.app"
rm -rf "$OUT"; mkdir -p "$APP"

SDK="$(xcrun --sdk iphoneos --show-sdk-path)"
SDKV="$(xcrun --sdk iphoneos --show-sdk-version)"
echo "SDK $SDKV — $(xcodebuild -version | head -1)"

# 1) الشيفرة
xcrun -sdk iphoneos swiftc -O -parse-as-library -module-name Rafidain \
  -target arm64-apple-ios15.0 -sdk "$SDK" "$ROOT/ios/App.swift" -o "$APP/Rafidain"

# 2) صفحة اللعبة والأصوات والخطوط
[ -f "$ROOT/ios/www/index.html" ] || { echo "missing ios/www/index.html"; exit 1; }
cp -R "$ROOT/ios/www" "$APP/www"
echo "www: $(du -sh "$APP/www" | cut -f1), voices: $(ls "$APP/www/voice" 2>/dev/null | grep -c m4a || true)"

# 3) Info.plist
sed -e "s/__BUILD__/$NUM/g" -e "s/__SDKV__/$SDKV/g" "$ROOT/ios/Info.plist" > "$APP/Info.plist"
printf 'APPL????' > "$APP/PkgInfo"

# 4) الأيقونة: كتالوج أصول (actool) وإن فشل فأيقونات PNG تقليدية
if xcrun actool "$ROOT/ios/Assets.xcassets" --compile "$APP" --platform iphoneos --minimum-deployment-target 15.0 \
     --app-icon AppIcon --output-partial-info-plist "$OUT/partial.plist" --target-device iphone --target-device ipad --output-format human-readable-text; then
  /usr/libexec/PlistBuddy -c "Merge $OUT/partial.plist" "$APP/Info.plist"
else
  echo "actool failed — legacy icons"
  cp "$ROOT"/ios/icons/AppIcon*.png "$APP/"
  /usr/libexec/PlistBuddy -c "Add :CFBundleIcons dict" -c "Add :CFBundleIcons:CFBundlePrimaryIcon dict" \
    -c "Add :CFBundleIcons:CFBundlePrimaryIcon:CFBundleIconFiles array" -c "Add :CFBundleIcons:CFBundlePrimaryIcon:CFBundleIconFiles:0 string AppIcon60x60" \
    -c "Add :CFBundleIcons~ipad dict" -c "Add :CFBundleIcons~ipad:CFBundlePrimaryIcon dict" \
    -c "Add :CFBundleIcons~ipad:CFBundlePrimaryIcon:CFBundleIconFiles array" -c "Add :CFBundleIcons~ipad:CFBundlePrimaryIcon:CFBundleIconFiles:0 string AppIcon60x60" \
    -c "Add :CFBundleIcons~ipad:CFBundlePrimaryIcon:CFBundleIconFiles:1 string AppIcon76x76" -c "Add :CFBundleIcons~ipad:CFBundlePrimaryIcon:CFBundleIconFiles:2 string AppIcon83.5x83.5" "$APP/Info.plist"
fi
plutil -lint "$APP/Info.plist"

# 5) توقيع مؤقت (ad-hoc) — Sideloadly / AltStore يعيدان التوقيع بحساب Apple الخاص بالمستخدم
codesign --force --sign - --timestamp=none "$APP"

# 6) الحزمة
( cd "$OUT" && zip -qry "$ROOT/ios/rafidain-ios.ipa" Payload )
file "$APP/Rafidain"
ls -la "$ROOT/ios/rafidain-ios.ipa"
