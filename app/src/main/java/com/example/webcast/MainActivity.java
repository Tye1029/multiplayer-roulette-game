package com.example.webcast;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.os.SystemClock;
import android.text.InputType;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.mediarouter.app.MediaRouteButton;
import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.MediaLoadRequestData;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.cast.framework.CastButtonFactory;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastSession;
import com.google.android.gms.cast.framework.CastState;
import com.google.android.gms.cast.framework.CastStateListener;
import com.google.android.gms.cast.framework.media.RemoteMediaClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private static final String PREFS = "webcast_prefs";
    private static final String KEY_LAST_URL = "last_url";
    private static final String KEY_HISTORY = "history_v1";
    private static final int MAX_HISTORY = 40;
    private static final long EXPLICIT_NAV_WINDOW_MS = 5000L;

    private WebView webView;
    private EditText addressBar;
    private TextView statusText;
    private Button videosButton;
    private CastContext castContext;
    private SharedPreferences prefs;

    private final Map<String, DetectedMedia> detectedMedia =
            Collections.synchronizedMap(new LinkedHashMap<>());

    private volatile String lastExplicitUrl = "";
    private volatile long lastExplicitAt = 0L;
    private volatile int blockedAds = 0;
    private volatile int detectorEvents = 0;
    private boolean deepSnifferInstalled = false;

    private final CastStateListener castStateListener = newState -> updateStatus();

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        View root = findViewById(R.id.rootContainer);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int left = insets.getSystemWindowInsetLeft();
            int top = insets.getSystemWindowInsetTop();
            int right = insets.getSystemWindowInsetRight();
            int bottom = insets.getSystemWindowInsetBottom();
            v.setPadding(left, top, right, bottom);
            return insets;
        });
        root.requestApplyInsets();

        addressBar = findViewById(R.id.addressBar);
        statusText = findViewById(R.id.statusText);
        videosButton = findViewById(R.id.videosButton);
        webView = findViewById(R.id.webView);
        MediaRouteButton castButton = findViewById(R.id.castButton);

        castContext = CastContext.getSharedInstance(this);
        CastButtonFactory.setUpMediaRouteButton(getApplicationContext(), castButton);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new WebCastBridge(this), "WebCastBridge");
        installDeepSniffer();
        installServiceWorkerSniffer();
        webView.setWebViewClient(new BrowserClient());
        webView.setWebChromeClient(new PopupBlockingChromeClient());

        addressBar.setSingleLine(true);
        addressBar.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        addressBar.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_GO ||
                    (event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER)) {
                navigate(addressBar.getText().toString());
                return true;
            }
            return false;
        });

        findViewById(R.id.goButton).setOnClickListener(v -> navigate(addressBar.getText().toString()));
        findViewById(R.id.backButton).setOnClickListener(v -> {
            if (webView.canGoBack()) webView.goBack();
        });
        findViewById(R.id.forwardButton).setOnClickListener(v -> {
            if (webView.canGoForward()) webView.goForward();
        });
        findViewById(R.id.reloadButton).setOnClickListener(v -> webView.reload());
        findViewById(R.id.historyButton).setOnClickListener(v -> showHistory());

        videosButton.setOnClickListener(v -> showDetectedVideos());
        findViewById(R.id.playPauseButton).setOnClickListener(v -> toggleRemotePlayback());
        findViewById(R.id.stopButton).setOnClickListener(v -> stopRemotePlayback());

        String lastUrl = prefs.getString(KEY_LAST_URL, "");
        if (lastUrl != null && !lastUrl.trim().isEmpty()) {
            markExplicit(lastUrl);
            addressBar.setText(lastUrl);
            webView.loadUrl(lastUrl);
        } else {
            addressBar.setText("");
            showStartPage();
        }
        updateStatus();
    }

    private void showStartPage() {
        webView.loadDataWithBaseURL(
                "https://webcast.local/start",
                getString(R.string.start_page_html),
                "text/html",
                "UTF-8",
                null
        );
    }

    @Override
    protected void onStart() {
        super.onStart();
        castContext.addCastStateListener(castStateListener);
        updateStatus();
    }

    @Override
    protected void onStop() {
        castContext.removeCastStateListener(castStateListener);
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("WebCastBridge");
            webView.destroy();
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private void navigate(String raw) {
        String url = raw == null ? "" : raw.trim();
        if (url.isEmpty()) return;
        if (!url.matches("(?i)^https?://.*")) url = "https://" + url;
        markExplicit(url);
        addressBar.setText(url);
        webView.loadUrl(url);
    }

    private void markExplicit(String url) {
        if (url == null) return;
        lastExplicitUrl = url;
        lastExplicitAt = SystemClock.elapsedRealtime();
    }

    private boolean isRecentExplicit(String url) {
        if (url == null || lastExplicitUrl == null || lastExplicitUrl.isEmpty()) return false;
        if (SystemClock.elapsedRealtime() - lastExplicitAt > EXPLICIT_NAV_WINDOW_MS) return false;
        if (equivalentUrl(url, lastExplicitUrl)) return true;

        String aHost = host(url);
        String bHost = host(lastExplicitUrl);
        if (isYouTubeHost(aHost) && isYouTubeHost(bHost)) return true;
        return false;
    }

    private boolean equivalentUrl(String a, String b) {
        if (a == null || b == null) return false;
        String x = stripFragment(a).replaceAll("/+$", "");
        String y = stripFragment(b).replaceAll("/+$", "");
        return x.equalsIgnoreCase(y);
    }

    private String stripFragment(String url) {
        int hash = url.indexOf('#');
        return hash >= 0 ? url.substring(0, hash) : url;
    }

    private class BrowserClient extends WebViewClient {
        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            if (!isInternalPage(url)) {
                addressBar.setText(url);
                detectedMedia.clear();
            }
            updateStatus();
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (!isInternalPage(url)) {
                addressBar.setText(url);
                prefs.edit().putString(KEY_LAST_URL, url).apply();
                recordHistory(view.getTitle(), url);
                injectPageHelpers(view);
            } else if (prefs.getString(KEY_LAST_URL, "").isEmpty()) {
                addressBar.setText("");
            }
            updateStatus();
        }

        @Override
        public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
            super.doUpdateVisitedHistory(view, url, isReload);
            if (!isInternalPage(url)) addressBar.setText(url);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            if (!request.isForMainFrame()) return false;
            return shouldBlockNavigation(url);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return shouldBlockNavigation(url);
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            inspectNetworkRequest(request, "network");

            if (isKnownAdUrl(url) && !looksLikeCastableMedia(url)) {
                noteBlockedAd();
                return emptyResponse();
            }
            return super.shouldInterceptRequest(view, request);
        }
    }

    private boolean shouldBlockNavigation(String url) {
        if (url == null) return false;

        if (!isHttpUrl(url)) {
            noteBlockedAd();
            return true;
        }

        if (isKnownAdUrl(url)) {
            noteBlockedAd();
            return true;
        }

        String current = webView.getUrl();
        String destinationHost = host(url);

        if (isYouTubeHost(destinationHost)
                && !isYouTubeHost(host(current))
                && !isRecentExplicit(url)) {
            noteBlockedAd();
            return true;
        }

        return false;
    }

    private class PopupBlockingChromeClient extends WebChromeClient {
        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
            WebView popup = new WebView(MainActivity.this);
            popup.setWebViewClient(new WebViewClient() {
                private boolean handled;

                private boolean handle(String url) {
                    if (handled) return true;
                    handled = true;
                    handlePopupDestination(url, isUserGesture);
                    popup.post(popup::destroy);
                    return true;
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return handle(request.getUrl().toString());
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    return handle(url);
                }
            });

            WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
            transport.setWebView(popup);
            resultMsg.sendToTarget();
            return true;
        }
    }

    private void handlePopupDestination(String url, boolean userGesture) {
        if (url == null || !isHttpUrl(url)) {
            noteBlockedAd();
            return;
        }

        if (isKnownAdUrl(url)) {
            noteBlockedAd();
            return;
        }

        String current = webView.getUrl();
        String destinationHost = host(url);

        if (isYouTubeHost(destinationHost)
                && !isYouTubeHost(host(current))
                && !isRecentExplicit(url)) {
            noteBlockedAd();
            return;
        }

        if (isRecentExplicit(url) || sameSite(current, url)) {
            runOnUiThread(() -> webView.loadUrl(url));
            return;
        }

        // Cross-site popup that was not the URL the user actually tapped.
        // These are the common pop-under/ad case on streaming sites.
        if (!userGesture) {
            noteBlockedAd();
            return;
        }

        noteBlockedAd();
    }

    public class WebCastBridge {
        private final Context context;

        WebCastBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void found(String url, String type) {
            if (url == null) return;
            String clean = url.trim();
            if (!isHttpUrl(clean)) return;
            String mime = normalizeMime(type, clean);
            addDetectedMedia(clean, mime, "page", scoreCandidate(clean, mime, "", "", ""));
        }

        @JavascriptInterface
        public void candidate(String url, String type, String source) {
            if (url == null) return;
            String clean = url.trim();
            if (!isHttpUrl(clean)) return;
            detectorEvents++;
            String mime = normalizeMime(type, clean);
            int score = scoreCandidate(clean, mime, "", "", "");
            if (score >= 55) addDetectedMedia(clean, mime, source == null ? "page" : source, score);
        }

        @JavascriptInterface
        public void clicked(String url) {
            if (url == null) return;
            String clean = url.trim();
            if (!isHttpUrl(clean)) return;
            markExplicit(clean);
        }
    }

    private void installDeepSniffer() {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(
                    webView,
                    buildDeepSnifferScript(),
                    Collections.singleton("*")
            );
            deepSnifferInstalled = true;
        }
    }

    private void installServiceWorkerSniffer() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)
                || !WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_SHOULD_INTERCEPT_REQUEST)) {
            return;
        }
        ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(new ServiceWorkerClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(@NonNull WebResourceRequest request) {
                inspectNetworkRequest(request, "service-worker");
                String url = request.getUrl().toString();
                if (isKnownAdUrl(url) && !looksLikeCastableMedia(url)) {
                    noteBlockedAd();
                    return emptyResponse();
                }
                return null;
            }
        });
    }

    private void injectPageHelpers(WebView view) {
        if (deepSnifferInstalled) {
            view.evaluateJavascript(
                    "(function(){try{if(window.__webCastDeepScan)window.__webCastDeepScan();}catch(e){}})();",
                    null
            );
        } else {
            view.evaluateJavascript(buildDeepSnifferScript(), null);
        }
    }

    private String buildDeepSnifferScript() {
        return "(function(){"
                + "if(window.__webCastDeepInstalled){try{if(window.__webCastDeepScan)window.__webCastDeepScan();}catch(e){}return;}"
                + "window.__webCastDeepInstalled=true;"
                + "function abs(u){try{return new URL(String(u||''),document.baseURI).href;}catch(e){return String(u||'');}}"
                + "function likely(u,t){u=String(u||'').toLowerCase();t=String(t||'').toLowerCase();"
                + "if(!u||u.indexOf('blob:')===0||u.indexOf('data:')===0)return false;"
                + "if(t.indexOf('video/')===0||t.indexOf('audio/')===0||t.indexOf('mpegurl')>=0||t.indexOf('dash+xml')>=0)return true;"
                + "if(/\\.(m3u8|mpd|mp4|m4v|webm|mov)(?:$|[?#/])/.test(u))return true;"
                + "if(/(?:manifest|playlist|master)(?:[/?#&=._-]|$)/.test(u))return true;"
                + "return false;}"
                + "function send(u,t,s){try{u=abs(u);if(!likely(u,t))return;"
                + "if(window.WebCastBridge&&WebCastBridge.candidate)WebCastBridge.candidate(String(u),String(t||''),String(s||'page'));}catch(e){}}"
                + "function click(u){try{u=abs(u);if(window.WebCastBridge&&WebCastBridge.clicked)WebCastBridge.clicked(String(u));}catch(e){}}"

                // Capture fetch before page code gets a chance to hide the source URL.
                + "try{var of=window.fetch;if(of){window.fetch=function(){"
                + "var a=arguments;var rq=a[0];var u=(typeof rq==='string')?rq:(rq&&rq.url?rq.url:'');"
                + "return of.apply(this,a).then(function(r){try{var ct=r.headers&&r.headers.get?r.headers.get('content-type'):'';"
                + "send(r.url||u,ct,'fetch');}catch(e){}return r;});};}}catch(e){}"

                // Capture XHR response URL + response Content-Type.
                + "try{var xo=XMLHttpRequest.prototype.open;var xs=XMLHttpRequest.prototype.send;"
                + "XMLHttpRequest.prototype.open=function(m,u){this.__wcUrl=abs(u);return xo.apply(this,arguments);};"
                + "XMLHttpRequest.prototype.send=function(){var x=this;"
                + "try{x.addEventListener('loadend',function(){try{var ct=x.getResponseHeader('content-type')||'';"
                + "send(x.responseURL||x.__wcUrl,ct,'xhr');}catch(e){}});}catch(e){}"
                + "return xs.apply(this,arguments);};}catch(e){}"

                // Track links the user actually taps for popup/ad discrimination.
                + "document.addEventListener('click',function(e){try{var n=e.target;"
                + "while(n&&n!==document){if(n.tagName==='A'&&n.href){click(n.href);break;}n=n.parentElement;}}catch(x){}},true);"

                // Scan media elements and page/player configuration scripts.
                + "window.__webCastDeepScan=function(){try{"
                + "document.querySelectorAll('video,audio').forEach(function(v){send(v.currentSrc||v.src,v.type,'dom-media');"
                + "v.querySelectorAll('source').forEach(function(s){send(s.src,s.type,'dom-source');});});"
                + "document.querySelectorAll('source').forEach(function(s){send(s.src,s.type,'dom-source');});"
                + "document.querySelectorAll('script').forEach(function(sc){var tx=sc.textContent||'';"
                + "var re=/(https?:\\\\?\\/\\\\?\\/[^\\s\\\"'<>]+?\\.(?:m3u8|mpd|mp4|m4v|webm|mov)(?:\\?[^\\s\\\"'<>]*)?)/gi;"
                + "var m,c=0;while((m=re.exec(tx))&&c++<12){send(m[1].replace(/\\\\\\//g,'/'),'','script-config');}});"
                + "}catch(e){}};"
                + "try{window.__webCastDeepScan();}catch(e){}"
                + "try{new MutationObserver(function(){window.__webCastDeepScan();}).observe(document.documentElement||document,"
                + "{subtree:true,childList:true,attributes:true,attributeFilter:['src']});}catch(e){}"

                // Resource timing catches media loaded by libraries that bypass our DOM scan.
                + "try{if(window.PerformanceObserver){new PerformanceObserver(function(l){"
                + "l.getEntries().forEach(function(e){send(e.name,'','resource');});}).observe({entryTypes:['resource']});}}catch(e){}"
                + "setInterval(function(){try{window.__webCastDeepScan();}catch(e){}},1800);"
                + "})();";
    }

    private void inspectNetworkRequest(WebResourceRequest request, String source) {
        if (request == null || request.getUrl() == null) return;
        String url = request.getUrl().toString();
        if (!isHttpUrl(url)) return;

        Map<String, String> headers = request.getRequestHeaders();
        String accept = header(headers, "Accept");
        String dest = header(headers, "Sec-Fetch-Dest");
        String range = header(headers, "Range");
        String mime = guessMimeFromHints(url, accept, dest);
        int score = scoreCandidate(url, mime, accept, dest, range);

        if (score >= 55) {
            detectorEvents++;
            addDetectedMedia(url, mime, source, score);
        }
    }

    private String header(Map<String, String> headers, String name) {
        if (headers == null || name == null) return "";
        for (Map.Entry<String, String> e : headers.entrySet()) {
            if (name.equalsIgnoreCase(e.getKey())) return e.getValue() == null ? "" : e.getValue();
        }
        return "";
    }

    private String guessMimeFromHints(String url, String accept, String dest) {
        String a = accept == null ? "" : accept.toLowerCase(Locale.US);
        String d = dest == null ? "" : dest.toLowerCase(Locale.US);
        if (a.contains("mpegurl")) return "application/x-mpegURL";
        if (a.contains("dash+xml")) return "application/dash+xml";
        if (a.contains("video/webm")) return "video/webm";
        if (a.contains("video/mp4") || "video".equals(d)) return "video/mp4";
        return guessMime(url);
    }

    private int scoreCandidate(String url, String mime, String accept, String dest, String range) {
        if (!isHttpUrl(url)) return 0;
        String u = url.toLowerCase(Locale.US);
        String m = mime == null ? "" : mime.toLowerCase(Locale.US);
        String a = accept == null ? "" : accept.toLowerCase(Locale.US);
        String d = dest == null ? "" : dest.toLowerCase(Locale.US);

        if (u.contains(".m3u8")) return 100;
        if (u.contains(".mpd")) return 99;
        if (u.matches(".*\\.(mp4|m4v|webm|mov)(?:$|[?#/]).*")) return 96;
        if (m.contains("mpegurl")) return 98;
        if (m.contains("dash+xml")) return 97;
        if (m.startsWith("video/")) return 94;
        if ("video".equals(d)) return 92;
        if (a.contains("video/") || a.contains("mpegurl") || a.contains("dash+xml")) return 90;

        boolean streamish = looksStreamish(url);
        if (streamish && range != null && !range.isEmpty()) return 82;
        if (streamish) return 68;
        if (range != null && !range.isEmpty() && !looksLikeStaticAsset(url)) return 58;
        return 0;
    }

    private boolean looksStreamish(String url) {
        if (url == null) return false;
        String u = url.toLowerCase(Locale.US);
        return u.contains("manifest") || u.contains("playlist") || u.contains("master")
                || u.contains("/hls") || u.contains("hls=") || u.contains("/dash")
                || u.contains("stream") || u.contains("video") || u.contains("media");
    }

    private boolean looksLikeStaticAsset(String url) {
        String u = url == null ? "" : url.toLowerCase(Locale.US);
        return u.matches(".*\\.(css|js|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf)(?:$|[?#]).*");
    }

    private void recordHistory(String title, String url) {
        if (!isHttpUrl(url) || isInternalPage(url)) return;

        try {
            JSONArray old = new JSONArray(prefs.getString(KEY_HISTORY, "[]"));
            JSONArray updated = new JSONArray();

            JSONObject first = new JSONObject();
            first.put("title", cleanTitle(title, url));
            first.put("url", url);
            updated.put(first);

            for (int i = 0; i < old.length() && updated.length() < MAX_HISTORY; i++) {
                JSONObject item = old.optJSONObject(i);
                if (item == null) continue;
                String oldUrl = item.optString("url", "");
                if (oldUrl.isEmpty() || equivalentUrl(url, oldUrl)) continue;
                updated.put(item);
            }

            prefs.edit().putString(KEY_HISTORY, updated.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    private String cleanTitle(String title, String url) {
        String t = title == null ? "" : title.trim();
        if (t.isEmpty() || t.equalsIgnoreCase("about:blank")) {
            String h = host(url);
            return h.isEmpty() ? url : h;
        }
        if (t.length() > 70) t = t.substring(0, 67) + "…";
        return t;
    }

    private void showHistory() {
        List<HistoryEntry> history = readHistory();
        if (history.isEmpty()) {
            Toast.makeText(this, "No browsing history yet.", Toast.LENGTH_SHORT).show();
            return;
        }

        String[] labels = new String[history.size()];
        for (int i = 0; i < history.size(); i++) {
            HistoryEntry item = history.get(i);
            labels[i] = item.title + "\n" + item.url;
        }

        new AlertDialog.Builder(this)
                .setTitle("History")
                .setItems(labels, (dialog, which) -> navigate(history.get(which).url))
                .setNeutralButton("Clear history", (dialog, which) -> {
                    prefs.edit().remove(KEY_HISTORY).apply();
                    Toast.makeText(this, "History cleared.", Toast.LENGTH_SHORT).show();
                })
                .setNegativeButton("Close", null)
                .show();
    }

    private List<HistoryEntry> readHistory() {
        List<HistoryEntry> result = new ArrayList<>();
        try {
            JSONArray array = new JSONArray(prefs.getString(KEY_HISTORY, "[]"));
            for (int i = 0; i < array.length(); i++) {
                JSONObject item = array.optJSONObject(i);
                if (item == null) continue;
                String url = item.optString("url", "");
                if (url.isEmpty()) continue;
                result.add(new HistoryEntry(item.optString("title", host(url)), url));
            }
        } catch (Exception ignored) {
        }
        return result;
    }

    private boolean looksLikeCastableMedia(String url) {
        if (!isHttpUrl(url)) return false;
        String path = Uri.parse(url).getPath();
        String lower = (path == null ? url : path).toLowerCase(Locale.US);
        return lower.endsWith(".m3u8") || lower.endsWith(".mpd") || lower.endsWith(".mp4")
                || lower.endsWith(".m4v") || lower.endsWith(".webm") || lower.endsWith(".mov")
                || lower.contains(".m3u8/") || lower.contains(".mpd/");
    }

    private boolean isHttpUrl(String url) {
        if (url == null) return false;
        String lower = url.toLowerCase(Locale.US);
        return lower.startsWith("http://") || lower.startsWith("https://");
    }

    private String normalizeMime(String type, String url) {
        if (type != null && !type.trim().isEmpty()) return type.trim();
        return guessMime(url);
    }

    private String guessMime(String url) {
        String lower = url.toLowerCase(Locale.US);
        if (lower.contains(".m3u8")) return "application/x-mpegURL";
        if (lower.contains(".mpd")) return "application/dash+xml";
        if (lower.contains(".webm")) return "video/webm";
        if (lower.contains(".mov")) return "video/quicktime";
        return "video/mp4";
    }

    private void addDetectedMedia(String url, String mime, String source) {
        addDetectedMedia(url, mime, source, scoreCandidate(url, mime, "", "", ""));
    }

    private void addDetectedMedia(String url, String mime, String source, int score) {
        if (!isHttpUrl(url) || score < 55) return;
        synchronized (detectedMedia) {
            DetectedMedia old = detectedMedia.get(url);
            if (old == null) {
                detectedMedia.put(url, new DetectedMedia(url, mime, source, score));
            } else {
                old.score = Math.max(old.score, score);
                if ((old.mime == null || old.mime.equals("video/mp4"))
                        && mime != null && !mime.isEmpty()) old.mime = mime;
                if (source != null && !source.isEmpty() && !old.source.contains(source)) {
                    old.source = old.source + "+" + source;
                }
            }
        }
        runOnUiThread(this::updateStatus);
    }

    private List<DetectedMedia> getSortedMedia() {
        List<DetectedMedia> list;
        synchronized (detectedMedia) {
            list = new ArrayList<>(detectedMedia.values());
        }
        list.sort(Comparator
                .comparingInt((DetectedMedia m) -> m.score).reversed()
                .thenComparingInt(m -> priority(m.mime))
                .thenComparingInt(m -> m.url.length()));
        return list;
    }

    private int priority(String mime) {
        if (mime == null) return 99;
        String m = mime.toLowerCase(Locale.US);
        if (m.contains("mpegurl")) return 0;
        if (m.contains("dash")) return 1;
        if (m.contains("mp4")) return 2;
        if (m.contains("webm")) return 3;
        return 8;
    }

    private void showDetectedVideos() {
        List<DetectedMedia> list = getSortedMedia();
        if (list.isEmpty()) {
            Toast.makeText(this,
                    "No stream detected yet. Start the video and let it play for a few seconds, then try again. Deep detection is active.",
                    Toast.LENGTH_LONG).show();
            injectPageHelpers(webView);
            return;
        }

        String[] labels = new String[list.size()];
        for (int i = 0; i < list.size(); i++) labels[i] = list.get(i).displayLabel();

        new AlertDialog.Builder(this)
                .setTitle("Detected videos")
                .setItems(labels, (dialog, which) -> castMedia(list.get(which)))
                .setNeutralButton("Clear list", (dialog, which) -> {
                    detectedMedia.clear();
                    updateStatus();
                })
                .setNegativeButton("Close", null)
                .show();
    }

    private void castMedia(@NonNull DetectedMedia media) {
        CastSession session = castContext.getSessionManager().getCurrentCastSession();
        if (session == null || !session.isConnected()) {
            Toast.makeText(this, "Tap the Cast icon and connect to a Chromecast first.", Toast.LENGTH_LONG).show();
            return;
        }

        RemoteMediaClient client = session.getRemoteMediaClient();
        if (client == null) {
            Toast.makeText(this, "Chromecast media channel is not ready.", Toast.LENGTH_LONG).show();
            return;
        }

        MediaMetadata metadata = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MOVIE);
        String title = webView.getTitle();
        metadata.putString(MediaMetadata.KEY_TITLE,
                title == null || title.trim().isEmpty() ? "Web video" : title);
        metadata.putString(MediaMetadata.KEY_SUBTITLE, safeHost(media.url));

        MediaInfo mediaInfo = new MediaInfo.Builder(media.url)
                .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                .setContentType(media.mime)
                .setMetadata(metadata)
                .build();

        client.load(new MediaLoadRequestData.Builder()
                .setMediaInfo(mediaInfo)
                .setAutoplay(true)
                .build());

        Toast.makeText(this, "Sending video to Chromecast…", Toast.LENGTH_SHORT).show();
    }

    private void toggleRemotePlayback() {
        RemoteMediaClient client = currentRemoteClient();
        if (client == null) {
            Toast.makeText(this, "Connect to a Chromecast first.", Toast.LENGTH_SHORT).show();
            return;
        }
        client.togglePlayback();
    }

    private void stopRemotePlayback() {
        RemoteMediaClient client = currentRemoteClient();
        if (client == null) {
            Toast.makeText(this, "Nothing is casting right now.", Toast.LENGTH_SHORT).show();
            return;
        }
        client.stop();
    }

    private RemoteMediaClient currentRemoteClient() {
        CastSession session = castContext.getSessionManager().getCurrentCastSession();
        if (session == null || !session.isConnected()) return null;
        return session.getRemoteMediaClient();
    }

    private void noteBlockedAd() {
        blockedAds++;
        runOnUiThread(this::updateStatus);
    }

    private WebResourceResponse emptyResponse() {
        return new WebResourceResponse(
                "text/plain",
                "utf-8",
                new ByteArrayInputStream(new byte[0])
        );
    }

    private boolean isKnownAdUrl(String url) {
        String h = host(url);
        if (h.isEmpty()) return false;

        String[] blocked = {
                "doubleclick.net",
                "googlesyndication.com",
                "googleadservices.com",
                "adservice.google.com",
                "adnxs.com",
                "adsrvr.org",
                "taboola.com",
                "outbrain.com",
                "criteo.com",
                "criteo.net",
                "pubmatic.com",
                "rubiconproject.com",
                "openx.net",
                "smartadserver.com",
                "revcontent.com",
                "adskeeper.com",
                "exoclick.com",
                "exosrv.com",
                "trafficjunky.net",
                "juicyads.com",
                "popads.net",
                "popcash.net",
                "propellerads.com",
                "onclicka.com",
                "onclickmega.com",
                "hilltopads.net"
        };

        for (String domain : blocked) {
            if (h.equals(domain) || h.endsWith("." + domain)) return true;
        }
        return false;
    }

    private boolean isYouTubeHost(String h) {
        if (h == null) return false;
        String host = h.toLowerCase(Locale.US);
        return host.equals("youtube.com") || host.endsWith(".youtube.com")
                || host.equals("youtu.be") || host.endsWith(".youtu.be");
    }

    private String host(String url) {
        try {
            String h = new URI(url).getHost();
            return h == null ? "" : h.toLowerCase(Locale.US);
        } catch (Exception ignored) {
            return "";
        }
    }

    private boolean sameSite(String a, String b) {
        String ah = host(a);
        String bh = host(b);
        if (ah.isEmpty() || bh.isEmpty()) return false;
        return ah.equals(bh) || ah.endsWith("." + bh) || bh.endsWith("." + ah);
    }

    private boolean isInternalPage(String url) {
        return "webcast.local".equals(host(url));
    }

    private String safeHost(String rawUrl) {
        String h = host(rawUrl);
        return h.isEmpty() ? rawUrl : h;
    }

    private void updateStatus() {
        if (statusText == null || videosButton == null) return;

        int count = detectedMedia.size();
        int state = castContext == null ? CastState.NO_DEVICES_AVAILABLE : castContext.getCastState();

        String cast;
        if (state == CastState.CONNECTED) cast = "Cast connected";
        else if (state == CastState.CONNECTING) cast = "Connecting…";
        else if (state == CastState.NOT_CONNECTED) cast = "Cast available";
        else cast = "No Cast device";

        statusText.setText(cast + " • " + count + " video" + (count == 1 ? "" : "s")
                + " • " + blockedAds + " blocked • deep");
        videosButton.setText("Videos (" + count + ")");
    }

    private static class HistoryEntry {
        final String title;
        final String url;

        HistoryEntry(String title, String url) {
            this.title = title;
            this.url = url;
        }
    }

    private static class DetectedMedia {
        final String url;
        String mime;
        String source;
        int score;

        DetectedMedia(String url, String mime, String source, int score) {
            this.url = url;
            this.mime = mime == null || mime.isEmpty() ? "video/mp4" : mime;
            this.source = source == null ? "unknown" : source;
            this.score = score;
        }

        String displayLabel() {
            String kind;
            String m = mime.toLowerCase(Locale.US);
            if (m.contains("mpegurl")) kind = "HLS";
            else if (m.contains("dash")) kind = "DASH";
            else if (m.contains("webm")) kind = "WEBM";
            else if (m.contains("quicktime")) kind = "MOV";
            else kind = "MP4/VIDEO";

            String host;
            String path;
            try {
                URI uri = new URI(url);
                host = uri.getHost() == null ? "website" : uri.getHost();
                path = uri.getPath();
            } catch (Exception e) {
                host = "website";
                path = url;
            }

            String file = (path == null || path.isEmpty())
                    ? "stream"
                    : path.substring(path.lastIndexOf('/') + 1);
            if (file.isEmpty()) file = "stream";
            if (file.length() > 55) file = file.substring(0, 52) + "…";

            return kind + " • " + host + " • " + score + "%\n" + file + "  [" + source + "]";
        }
    }
}
