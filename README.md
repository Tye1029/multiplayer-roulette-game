# WebCast Android MVP

Android WebView + Google Cast sender proof of concept for casting direct website video streams to Chromecast.

## Build
GitHub Actions builds an installable debug APK on the `webcast-app-build` branch.

## Current media detection
- MP4 / M4V
- HLS (.m3u8)
- MPEG-DASH (.mpd)
- WebM
- MOV

Some DRM, blob-only, cookie/header-protected, or site-specific streams may require additional handling.
