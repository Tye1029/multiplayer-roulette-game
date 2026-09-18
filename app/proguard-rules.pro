# Keep JavascriptInterface bridge methods used by WebView.
-keepclassmembers class com.example.webcast.MainActivity$VideoBridge {
    @android.webkit.JavascriptInterface <methods>;
}
