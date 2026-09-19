package com.example.webcast;

import android.annotation.SuppressLint;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.os.PowerManager;
import android.os.SystemClock;
import android.text.InputType;
import android.util.Base64;
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

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URI;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.util.UUID;

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
    private final Map<String, RequestSnapshot> rawRequests =
            Collections.synchronizedMap(new LinkedHashMap<>());
    private final Set<String> probedUrls = Collections.synchronizedSet(new HashSet<>());
    private final ExecutorService probeExecutor = Executors.newFixedThreadPool(4);
    private final AtomicInteger activeProbes = new AtomicInteger(0);
    private final Map<String, Map<String, String>> mediaRequestHeaders =
            Collections.synchronizedMap(new LinkedHashMap<>());
    private final Map<String, AbyssVirtualSource> abyssVirtualSources =
            Collections.synchronizedMap(new LinkedHashMap<>());
    private volatile String lastRangeVideoUrl = "";
    private volatile String webViewUserAgent = "";
    private volatile boolean pauseLocalForCast = false;
    private final Set<String> processedAbyssDatas =
            Collections.synchronizedSet(new HashSet<>());
    private final Set<String> processedPlayerFrames =
            Collections.synchronizedSet(new HashSet<>());
    private RelayServer relayServer;
    private PowerManager.WakeLock relayWakeLock;
    private final AtomicInteger blobHlsHits = new AtomicInteger(0);
    private final AtomicInteger blobVideoHits = new AtomicInteger(0);
    private final AtomicInteger mseHits = new AtomicInteger(0);
    private final List<String> diagnosticLog = Collections.synchronizedList(new ArrayList<>());

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
        webViewUserAgent = settings.getUserAgentString();

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
        findViewById(R.id.debugButton).setOnClickListener(v -> showDebugReport());
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
        probeExecutor.shutdownNow();
        stopRelayServer();
        releaseRelayWakeLock();
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
                rawRequests.clear();
                probedUrls.clear();
                diagnosticLog.clear();
                mediaRequestHeaders.clear();
                abyssVirtualSources.clear();
                lastRangeVideoUrl = "";
                processedAbyssDatas.clear();
                processedPlayerFrames.clear();
                pauseLocalForCast = false;
                blobHlsHits.set(0);
                blobVideoHits.set(0);
                mseHits.set(0);
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
            int score = scoreCandidate(clean, mime, "", "", "");
            if (score >= 90 && !isSegmentLike(clean)) {
                addDetectedMedia(clean, mime, "page", score);
            } else {
                Map<String, String> emptyHeaders = new LinkedHashMap<>();
                rememberRawRequest(clean, emptyHeaders, "page");
                queueProbe(clean, emptyHeaders, "page", false);
            }
        }

        @JavascriptInterface
        public void candidate(String url, String type, String source) {
            if (url == null) return;
            String clean = url.trim();
            if (!isHttpUrl(clean)) return;
            detectorEvents++;
            String mime = normalizeMime(type, clean);
            int score = scoreCandidate(clean, mime, "", "", "");
            String srcName = source == null ? "page" : source;
            if (score >= 90 && !isSegmentLike(clean)) {
                addDetectedMedia(clean, mime, srcName, score);
            } else {
                Map<String, String> emptyHeaders = new LinkedHashMap<>();
                rememberRawRequest(clean, emptyHeaders, srcName);
                queueProbe(clean, emptyHeaders, srcName, false);
            }
        }

        @JavascriptInterface
        public void frameFound(String frameUrl, boolean visible, String parentUrl) {
            if (frameUrl == null || !isHttpUrl(frameUrl)) return;
            if (!visible && !looksLikePlayerFrame(frameUrl)) return;
            String clean = frameUrl.trim();
            if (!processedPlayerFrames.add(clean)) return;

            addDiagnostic("FRAME visible=" + visible
                    + " url=" + redactUrl(clean)
                    + " parent=" + redactUrl(parentUrl));
            probeExecutor.execute(() -> inspectPlayerFrame(clean, parentUrl, 0));
        }

        @JavascriptInterface
        public void abyssDatas(String encoded, String frameUrl) {
            if (encoded == null || encoded.length() < 50) return;
            String key = Integer.toHexString(encoded.hashCode()) + ":" + encoded.length();
            if (!processedAbyssDatas.add(key)) return;

            addDiagnostic("ABYSS_DATAS bytes=" + encoded.length()
                    + " frame=" + redactUrl(frameUrl));
            probeExecutor.execute(() -> extractAbyssSources(encoded, frameUrl));
        }

        @JavascriptInterface
        public boolean shouldPauseForCast() {
            return pauseLocalForCast;
        }

        @JavascriptInterface
        public void blobMeta(String blobUrl, String type, long size, String frameUrl) {
            String t = type == null ? "" : type.toLowerCase(Locale.US);
            if (t.contains("mpegurl") || t.contains("dash")) {
                blobHlsHits.incrementAndGet();
                addDiagnostic("BLOB_PLAYLIST type=" + safeText(type) + " size=" + size
                        + " frame=" + redactUrl(frameUrl));
            } else if (t.startsWith("video/")) {
                blobVideoHits.incrementAndGet();
                addDiagnostic("BLOB_VIDEO type=" + safeText(type) + " size=" + size
                        + " frame=" + redactUrl(frameUrl));
            } else {
                addDiagnostic("BLOB type=" + safeText(type) + " size=" + size
                        + " frame=" + redactUrl(frameUrl));
            }
            runOnUiThread(MainActivity.this::updateStatus);
        }

        @JavascriptInterface
        public void mseFound(String blobUrl, String frameUrl) {
            mseHits.incrementAndGet();
            addDiagnostic("MEDIA_SOURCE blob frame=" + redactUrl(frameUrl));
            runOnUiThread(MainActivity.this::updateStatus);
        }

        @JavascriptInterface
        public void payload(String sourceUrl, String contentType, String text,
                            String frameUrl, String source) {
            if (text == null || text.isEmpty()) return;
            String ct = contentType == null ? "" : contentType;
            String srcName = source == null ? "payload" : source;
            int len = text.length();

            boolean hls = text.contains("#EXTM3U");
            boolean dash = text.toUpperCase(Locale.US).contains("<MPD");
            boolean mediaRefs = containsMediaReference(text);

            if (hls || dash || mediaRefs) {
                addDiagnostic("PAYLOAD source=" + srcName
                        + " type=" + safeText(ct)
                        + " bytes=" + len
                        + " url=" + redactUrl(sourceUrl)
                        + " frame=" + redactUrl(frameUrl)
                        + (hls ? " HLS" : "")
                        + (dash ? " DASH" : ""));
            }

            if (hls) {
                if (sourceUrl != null && isHttpUrl(sourceUrl)) {
                    addDetectedMedia(sourceUrl, "application/x-mpegURL", srcName + "+body", 115);
                }
                extractMediaUrlsFromText(text, sourceUrl, frameUrl, srcName + "+hls");
            } else if (dash) {
                if (sourceUrl != null && isHttpUrl(sourceUrl)) {
                    addDetectedMedia(sourceUrl, "application/dash+xml", srcName + "+body", 114);
                }
                extractMediaUrlsFromText(text, sourceUrl, frameUrl, srcName + "+dash");
            } else if (mediaRefs) {
                extractMediaUrlsFromText(text, sourceUrl, frameUrl, srcName + "+text");
            }
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
                + "function isMediaText(t){t=String(t||'');return t.indexOf('#EXTM3U')>=0||/<MPD[\\\\s>]/i.test(t)||"
                + "/https?:\\\\?\\\\/\\\\?\\\\/[^\\\\s\\\"'<>]+\\\\.(m3u8|mpd|mp4|m4v|webm|mov)/i.test(t);}"
                + "function likely(u,t){u=String(u||'').toLowerCase();t=String(t||'').toLowerCase();"
                + "if(!u||u.indexOf('data:')===0)return false;"
                + "if(t.indexOf('video/')===0||t.indexOf('audio/')===0||t.indexOf('mpegurl')>=0||t.indexOf('dash+xml')>=0)return true;"
                + "if(/\\\\.(m3u8|mpd|mp4|m4v|webm|mov)(?:$|[?#/])/.test(u))return true;"
                + "if(/(?:manifest|playlist|master)(?:[/?#&=._-]|$)/.test(u))return true;"
                + "return false;}"
                + "function send(u,t,s){try{u=abs(u);if(!likely(u,t)||u.indexOf('blob:')===0)return;"
                + "if(window.WebCastBridge&&WebCastBridge.candidate)WebCastBridge.candidate(String(u),String(t||''),String(s||'page'));}catch(e){}}"
                + "function click(u){try{u=abs(u);if(window.WebCastBridge&&WebCastBridge.clicked)WebCastBridge.clicked(String(u));}catch(e){}}"
                + "function abyssScan(){try{window.__wcAbyssSent=window.__wcAbyssSent||{};"
                + "document.querySelectorAll('script').forEach(function(sc){var tx=sc.textContent||'';"
                + "var m=tx.match(/(?:const|var)\\s+datas\\s*=\\s*\"([^\"]{50,})\"/);"
                + "if(m&&!window.__wcAbyssSent[m[1].slice(0,32)]){window.__wcAbyssSent[m[1].slice(0,32)]=1;"
                + "if(window.WebCastBridge&&WebCastBridge.abyssDatas)WebCastBridge.abyssDatas(m[1],String(location.href));}});}catch(e){}}"
                + "function pauseIfAsked(){try{if(window.WebCastBridge&&WebCastBridge.shouldPauseForCast&&WebCastBridge.shouldPauseForCast()){"
                + "document.querySelectorAll('video,audio').forEach(function(v){try{v.pause();}catch(e){}});"
                + "try{if(window.jwplayer&&typeof jwplayer().pause==='function')jwplayer().pause(true);}catch(e){}"
                + "}}catch(e){}}"
                + "function payload(u,t,x,s){try{if(!x)return;x=String(x);if(x.length>350000)x=x.slice(0,350000);"
                + "if(!isMediaText(x))return;if(window.WebCastBridge&&WebCastBridge.payload)"
                + "WebCastBridge.payload(String(u||''),String(t||''),x,String(location.href),String(s||'payload'));}catch(e){}}"
                + "function inspectBlob(b,u,s){try{if(!b)return;var t=String(b.type||'');var z=Number(b.size||0);"
                + "if(window.WebCastBridge&&WebCastBridge.blobMeta)WebCastBridge.blobMeta(String(u||''),t,z,String(location.href));"
                + "if(z>0&&z<1500000&&(t.indexOf('mpegurl')>=0||t.indexOf('dash')>=0||t.indexOf('json')>=0||t.indexOf('text')>=0)){"
                + "if(b.text)b.text().then(function(x){payload(u,t,x,s||'blob');}).catch(function(){});"
                + "else{var fr=new FileReader();fr.onload=function(){payload(u,t,fr.result,s||'blob');};fr.readAsText(b);}}}catch(e){}}"

                // Catch blob: URLs, which normal Android WebView request interception cannot see.
                + "try{var ocu=URL.createObjectURL.bind(URL);URL.createObjectURL=function(o){var u=ocu(o);try{"
                + "if(typeof Blob!=='undefined'&&o instanceof Blob){inspectBlob(o,u,'createObjectURL');}"
                + "else if(typeof MediaSource!=='undefined'&&o instanceof MediaSource){"
                + "if(window.WebCastBridge&&WebCastBridge.mseFound)WebCastBridge.mseFound(String(u),String(location.href));}"
                + "}catch(e){}return u;};if(window.webkitURL)window.webkitURL.createObjectURL=URL.createObjectURL;}catch(e){}"

                // Capture fetch response metadata and inspect text/JSON bodies without consuming the real response.
                + "try{var of=window.fetch;if(of){window.fetch=function(){var a=arguments;var rq=a[0];"
                + "var u=(typeof rq==='string')?rq:(rq&&rq.url?rq.url:'');return of.apply(this,a).then(function(r){try{"
                + "var ct=r.headers&&r.headers.get?r.headers.get('content-type'):'';send(r.url||u,ct,'fetch');"
                + "var lc=String(ct||'').toLowerCase();if(lc.indexOf('mpegurl')>=0||lc.indexOf('dash')>=0||"
                + "lc.indexOf('json')>=0||lc.indexOf('text/')>=0||String(r.url||u).indexOf('playm4u')>=0){"
                + "r.clone().text().then(function(x){payload(r.url||u,ct,x,'fetch-body');}).catch(function(){});}"
                + "}catch(e){}return r;});};}}catch(e){}"

                // Capture XHR including JSON/text and blob responses.
                + "try{var xo=XMLHttpRequest.prototype.open;var xs=XMLHttpRequest.prototype.send;"
                + "XMLHttpRequest.prototype.open=function(m,u){this.__wcUrl=abs(u);return xo.apply(this,arguments);};"
                + "XMLHttpRequest.prototype.send=function(){var x=this;try{x.addEventListener('loadend',function(){try{"
                + "var ct=x.getResponseHeader('content-type')||'';var u=x.responseURL||x.__wcUrl;send(u,ct,'xhr');"
                + "var rt=String(x.responseType||'');if(rt===''||rt==='text'){payload(u,ct,x.responseText,'xhr-body');}"
                + "else if(rt==='json'){payload(u,ct,JSON.stringify(x.response),'xhr-json');}"
                + "else if(rt==='blob'){inspectBlob(x.response,u,'xhr-blob');}"
                + "}catch(e){}});}catch(e){}return xs.apply(this,arguments);};}catch(e){}"

                // Some players decode the playlist from base64 or JSON after the network request.
                + "try{var oa=window.atob;if(oa){window.atob=function(s){var r=oa.call(this,s);"
                + "try{if(isMediaText(r))payload('atob:','text/plain',r,'atob');}catch(e){}return r;};}}catch(e){}"
                + "try{var oj=JSON.parse;JSON.parse=function(s){var r=oj.apply(this,arguments);"
                + "try{if(typeof s==='string'&&s.length<350000&&isMediaText(s))payload('json:','application/json',s,'json-parse');}catch(e){}return r;};}catch(e){}"

                // Track clicked links so popup blocking does not confuse a legitimate server selection with an ad.
                + "document.addEventListener('click',function(e){try{var n=e.target;while(n&&n!==document){"
                + "if(n.tagName==='A'&&n.href){click(n.href);break;}n=n.parentElement;}}catch(x){}},true);"

                + "window.__webCastDeepScan=function(){try{abyssScan();pauseIfAsked();"
                + "document.querySelectorAll('iframe').forEach(function(f){try{var u=f.src||f.getAttribute('src')||'';"
                + "if(!u)return;var r=f.getBoundingClientRect();var cs=getComputedStyle(f);"
                + "var vis=r.width>80&&r.height>60&&cs.display!=='none'&&cs.visibility!=='hidden'&&parseFloat(cs.opacity||'1')>0;"
                + "if(window.WebCastBridge&&WebCastBridge.frameFound)WebCastBridge.frameFound(abs(u),!!vis,String(location.href));"
                + "}catch(e){}});"
                + "document.querySelectorAll('video,audio').forEach(function(v){"
                + "var u=v.currentSrc||v.src;if(u&&u.indexOf('blob:')===0){"
                + "if(window.WebCastBridge&&WebCastBridge.blobMeta)WebCastBridge.blobMeta(String(u),String(v.type||'video/unknown'),0,String(location.href));}"
                + "else send(u,v.type,'dom-media');v.querySelectorAll('source').forEach(function(s){send(s.src,s.type,'dom-source');});});"
                + "document.querySelectorAll('source').forEach(function(s){send(s.src,s.type,'dom-source');});"
                + "document.querySelectorAll('script').forEach(function(sc){var tx=sc.textContent||'';"
                + "if(tx.length<350000&&isMediaText(tx))payload('script:', 'text/javascript', tx, 'script-config');});"
                + "}catch(e){}};try{window.__webCastDeepScan();}catch(e){}"
                + "try{new MutationObserver(function(){window.__webCastDeepScan();}).observe(document.documentElement||document,"
                + "{subtree:true,childList:true,attributes:true,attributeFilter:['src']});}catch(e){}"
                + "try{if(window.PerformanceObserver){new PerformanceObserver(function(l){l.getEntries().forEach(function(e){"
                + "send(e.name,'','resource');});}).observe({entryTypes:['resource']});}}catch(e){}"
                + "setInterval(function(){try{window.__webCastDeepScan();pauseIfAsked();}catch(e){}},700);"
                + "})();";
    }

    private void inspectNetworkRequest(WebResourceRequest request, String source) {
        if (request == null || request.getUrl() == null) return;
        String url = request.getUrl().toString();
        if (!isHttpUrl(url) || isKnownAdUrl(url)) return;

        Map<String, String> headers = new LinkedHashMap<>();
        if (request.getRequestHeaders() != null) headers.putAll(request.getRequestHeaders());
        String method = request.getMethod() == null ? "GET" : request.getMethod();

        if ("GET".equalsIgnoreCase(method) && !looksLikeStaticAsset(url)) {
            rememberRawRequest(url, headers, source);
        }

        String h = host(url);
        String rangeHeader = header(headers, "Range");
        String acceptHeader = header(headers, "Accept");
        String destHeader = header(headers, "Sec-Fetch-Dest");
        if (looksStreamish(url) || !rangeHeader.isEmpty()
                || acceptHeader.toLowerCase(Locale.US).contains("video")
                || h.contains("playm4u") || h.contains("vnstream") || h.contains("playhq")) {
            addDiagnostic("REQ " + source
                    + " host=" + h
                    + " path=" + redactPath(url)
                    + " accept=" + safeHeader(acceptHeader)
                    + " range=" + safeHeader(rangeHeader)
                    + " dest=" + safeHeader(destHeader));
        }

        String accept = header(headers, "Accept");
        String dest = header(headers, "Sec-Fetch-Dest");
        String range = header(headers, "Range");

        if (isPlayerDocumentRequest(url, method, headers)) {
            addDiagnostic("PLAYER_DOC_REQ host=" + host(url)
                    + " path=" + redactPath(url)
                    + " dest=" + safeHeader(dest)
                    + " accept=" + safeHeader(accept));
            if (processedPlayerFrames.add(url)) {
                String parent = prefs == null ? "" : prefs.getString(KEY_LAST_URL, "");
                Map<String, String> requestHeaders = new LinkedHashMap<>(headers);
                probeExecutor.execute(() ->
                        inspectPlayerFrameFromRequest(url, parent, requestHeaders, 0));
            }
        }

        // Some streaming players hide the real progressive file behind a service worker
        // and an opaque, extensionless CDN URL. A large byte-range request is the key signal.
        if (isStrongRangedVideoRequest(url, source, accept, dest, range)) {
            detectorEvents++;
            rememberRawRequest(url, headers, source);
            addDiagnostic("RANGE_VIDEO host=" + host(url)
                    + " path=" + redactPath(url)
                    + " range=" + safeHeader(range)
                    + " source=" + source);
            lastRangeVideoUrl = url;
            synchronized (mediaRequestHeaders) {
                mediaRequestHeaders.put(url, new LinkedHashMap<>(headers));
            }
            addDetectedMedia(url, "video/mp4", source + "+range-video", 118);
            return;
        }

        String mime = guessMimeFromHints(url, accept, dest);
        int score = scoreCandidate(url, mime, accept, dest, range);

        // Obvious roots can be shown immediately; ambiguous/extensionless traffic gets verified.
        if (score >= 90 && !isSegmentLike(url)) {
            detectorEvents++;
            addDetectedMedia(url, mime, source, score);
        } else if (shouldAutoProbe(url, headers)) {
            queueProbe(url, headers, source, false);
        }
    }

    private void rememberRawRequest(String url, Map<String, String> headers, String source) {
        synchronized (rawRequests) {
            rawRequests.remove(url);
            rawRequests.put(url, new RequestSnapshot(url, headers, source));
            while (rawRequests.size() > 120) {
                String first = rawRequests.keySet().iterator().next();
                rawRequests.remove(first);
            }
        }
    }

    private boolean isPlayerDocumentRequest(String url, String method,
                                            Map<String, String> headers) {
        if (!"GET".equalsIgnoreCase(method) || !isHttpUrl(url)) return false;
        if (isKnownAdUrl(url) || looksLikeStaticAsset(url)) return false;

        String current = prefs == null ? "" : prefs.getString(KEY_LAST_URL, "");
        String currentHost = host(current);
        String h = host(url);
        if (h.isEmpty() || h.equals(currentHost) || h.endsWith(".m4uhd.to")) return false;

        String dest = header(headers, "Sec-Fetch-Dest").toLowerCase(Locale.US);
        String accept = header(headers, "Accept").toLowerCase(Locale.US);

        if ("iframe".equals(dest) || "document".equals(dest)) return true;
        if (accept.contains("text/html") || accept.contains("application/xhtml+xml")) return true;
        if (looksLikePlayerFrame(url)) return true;

        return false;
    }

    private boolean isStrongRangedVideoRequest(String url, String source,
                                               String accept, String dest, String range) {
        if (!"service-worker".equals(source)) return false;
        if (!isHttpUrl(url) || isKnownAdUrl(url) || looksLikeStaticAsset(url)) return false;
        if (range == null || range.isEmpty()) return false;

        long span = parseRangeSpan(range);
        long start = parseRangeStart(range);
        if (span < 512 * 1024L) return false;

        String path;
        try {
            path = Uri.parse(url).getPath();
        } catch (Exception ignored) {
            path = "";
        }
        String p = path == null ? "" : path.toLowerCase(Locale.US);

        // Known fragment/playlist file types should continue through the normal detector.
        if (p.matches(".*\\.(ts|m4s|m4a|aac|vtt|srt|m3u8|mpd)(?:$|[?#]).*")) return false;

        String a = accept == null ? "" : accept.toLowerCase(Locale.US);
        String d = dest == null ? "" : dest.toLowerCase(Locale.US);

        // Initial 0-based multi-megabyte range on an opaque URL is the strongest case.
        if (start == 0 && span >= 1024 * 1024L) return true;

        // Continued ranges on the same kind of stream are also valid.
        boolean opaquePath = !p.matches(".*\\.[a-z0-9]{2,5}$");
        return opaquePath && span >= 1024 * 1024L
                && (a.isEmpty() || a.equals("*/*") || a.contains("video"))
                && (d.isEmpty() || d.equals("video"));
    }

    private long parseRangeStart(String range) {
        if (range == null) return -1;
        Matcher m = Pattern.compile("(?i)bytes=(\\d+)-(\\d*)").matcher(range.trim());
        if (!m.find()) return -1;
        try {
            return Long.parseLong(m.group(1));
        } catch (Exception ignored) {
            return -1;
        }
    }

    private long parseRangeSpan(String range) {
        if (range == null) return -1;
        Matcher m = Pattern.compile("(?i)bytes=(\\d+)-(\\d+)").matcher(range.trim());
        if (!m.find()) return -1;
        try {
            long start = Long.parseLong(m.group(1));
            long end = Long.parseLong(m.group(2));
            return end >= start ? (end - start + 1L) : -1;
        } catch (Exception ignored) {
            return -1;
        }
    }

    private boolean shouldAutoProbe(String url, Map<String, String> headers) {
        if (isSegmentLike(url) || looksLikeStaticAsset(url)) return false;
        String range = header(headers, "Range");
        String accept = header(headers, "Accept").toLowerCase(Locale.US);
        String dest = header(headers, "Sec-Fetch-Dest").toLowerCase(Locale.US);

        if (looksLikeCastableMedia(url)) return true;
        if (looksStreamish(url)) return true;
        if (!range.isEmpty()) return true;
        if ("video".equals(dest)) return true;
        if (accept.contains("video/") || accept.contains("mpegurl") || accept.contains("dash+xml")) return true;
        return false;
    }

    private void queueProbe(String url, Map<String, String> headers, String source, boolean force) {
        if (!isHttpUrl(url) || isKnownAdUrl(url) || looksLikeStaticAsset(url)) return;
        if (!force && isSegmentLike(url)) return;
        if (!probedUrls.add(url)) return;

        activeProbes.incrementAndGet();
        runOnUiThread(this::updateStatus);
        probeExecutor.execute(() -> {
            try {
                ProbeResult result = probeUrl(url, headers);
                if (result != null && result.isPlayableRoot) {
                    addDetectedMedia(url, result.mime, source + "+verified", result.score);
                }
            } finally {
                activeProbes.decrementAndGet();
                runOnUiThread(this::updateStatus);
            }
        });
    }

    private ProbeResult probeUrl(String rawUrl, Map<String, String> originalHeaders) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(rawUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(7000);
            conn.setReadTimeout(7000);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Range", "bytes=0-8191");
            conn.setRequestProperty("Accept-Encoding", "identity");

            if (originalHeaders != null) {
                for (Map.Entry<String, String> e : originalHeaders.entrySet()) {
                    String k = e.getKey();
                    String v = e.getValue();
                    if (k == null || v == null) continue;
                    if ("Host".equalsIgnoreCase(k) || "Connection".equalsIgnoreCase(k)
                            || "Content-Length".equalsIgnoreCase(k) || "Accept-Encoding".equalsIgnoreCase(k)
                            || "Range".equalsIgnoreCase(k)) continue;
                    try { conn.setRequestProperty(k, v); } catch (Exception ignored) {}
                }
            }

            String cookie = CookieManager.getInstance().getCookie(rawUrl);
            if (cookie != null && !cookie.isEmpty()) conn.setRequestProperty("Cookie", cookie);

            String referer = prefs == null ? null : prefs.getString(KEY_LAST_URL, "");
            if (referer != null && isHttpUrl(referer) && conn.getRequestProperty("Referer") == null) {
                conn.setRequestProperty("Referer", referer);
            }

            int code = conn.getResponseCode();
            if (code < 200 || code >= 400) return null;

            String contentType = conn.getContentType();
            String mime = normalizeContentType(contentType);
            byte[] prefix = readPrefix(conn, 8192);
            String textPrefix = new String(prefix, java.nio.charset.StandardCharsets.UTF_8).trim();

            if (textPrefix.startsWith("#EXTM3U")) {
                return new ProbeResult("application/x-mpegURL", true, 110);
            }
            String upper = textPrefix.length() > 512 ? textPrefix.substring(0, 512).toUpperCase(Locale.US)
                    : textPrefix.toUpperCase(Locale.US);
            if (upper.contains("<MPD") || upper.startsWith("<?XML") && upper.contains("<MPD")) {
                return new ProbeResult("application/dash+xml", true, 109);
            }

            String lowerMime = mime.toLowerCase(Locale.US);
            if (lowerMime.contains("mpegurl")) return new ProbeResult("application/x-mpegURL", true, 108);
            if (lowerMime.contains("dash+xml")) return new ProbeResult("application/dash+xml", true, 107);

            // Segment MIME types are media bytes, but they are not independently playable root URLs.
            if (isSegmentMime(lowerMime) || isSegmentLike(rawUrl)) return null;

            if (lowerMime.startsWith("video/")) {
                return new ProbeResult(mime, true, 102);
            }

            if (looksLikeDirectMediaMagic(prefix)) {
                String guessed = guessMime(rawUrl);
                if (guessed.isEmpty()) guessed = "video/mp4";
                return new ProbeResult(guessed, true, 100);
            }

            return null;
        } catch (Exception ignored) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private byte[] readPrefix(HttpURLConnection conn, int max) {
        try (InputStream in = new BufferedInputStream(conn.getInputStream());
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[2048];
            int total = 0;
            while (total < max) {
                int n = in.read(buf, 0, Math.min(buf.length, max - total));
                if (n < 0) break;
                out.write(buf, 0, n);
                total += n;
            }
            return out.toByteArray();
        } catch (Exception ignored) {
            return new byte[0];
        }
    }

    private String normalizeContentType(String raw) {
        if (raw == null) return "";
        int semi = raw.indexOf(';');
        return (semi >= 0 ? raw.substring(0, semi) : raw).trim();
    }

    private boolean isSegmentMime(String mime) {
        if (mime == null) return false;
        String m = mime.toLowerCase(Locale.US);
        return m.contains("mp2t") || m.contains("iso.segment") || m.contains("m4s")
                || m.equals("audio/aac") || m.equals("audio/mp4");
    }

    private boolean looksLikeDirectMediaMagic(byte[] b) {
        if (b == null || b.length < 12) return false;
        // ISO BMFF / MP4: bytes 4..7 are usually "ftyp".
        if (b.length >= 8 && b[4] == 'f' && b[5] == 't' && b[6] == 'y' && b[7] == 'p') return true;
        // WebM/Matroska EBML header.
        return (b[0] & 0xff) == 0x1A && (b[1] & 0xff) == 0x45
                && (b[2] & 0xff) == 0xDF && (b[3] & 0xff) == 0xA3;
    }

    private void deepProbeCapturedRequests() {
        List<RequestSnapshot> snapshots;
        synchronized (rawRequests) {
            snapshots = new ArrayList<>(rawRequests.values());
        }
        Collections.reverse(snapshots);

        int queued = 0;
        // Prefer recent requests; they are most likely to belong to the video the user just started.
        for (RequestSnapshot s : snapshots) {
            if (queued >= 70) break;
            if (looksLikeStaticAsset(s.url) || isKnownAdUrl(s.url)) continue;
            queueProbe(s.url, s.headers, s.source, true);
            queued++;
        }

        if (queued == 0) {
            Toast.makeText(this, "No stream-like requests were captured yet. Start the video first.", Toast.LENGTH_LONG).show();
        } else {
            Toast.makeText(this, "Analyzing " + queued + " recent requests… tap Videos again in a moment.",
                    Toast.LENGTH_LONG).show();
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

        if (isSegmentLike(url)) return 0;
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

    private boolean isSegmentLike(String url) {
        if (url == null) return false;
        String u = url.toLowerCase(Locale.US);
        String path;
        try {
            path = Uri.parse(url).getPath();
        } catch (Exception ignored) {
            path = url;
        }
        String p = path == null ? u : path.toLowerCase(Locale.US);

        if (p.matches(".*\\.(ts|m4s|m4a|aac|ac3|ec3|vtt|srt|ttml|key)(?:$|[?#]).*")) return true;

        String file = p.substring(p.lastIndexOf('/') + 1);
        if (file.matches("(?i)^(init|initialization|segment|seg|chunk|frag|fragment|part)[-_]?[a-z0-9._-]*\\.(mp4|m4s|m4a)$")) {
            return true;
        }

        if (!p.contains(".m3u8") && !p.contains(".mpd")) {
            if (p.contains("/segments/") || p.contains("/segment/")
                    || p.contains("/chunks/") || p.contains("/chunk/")
                    || p.contains("/fragments/") || p.contains("/fragment/")) {
                return true;
            }
        }
        return false;
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

    private boolean looksLikePlayerFrame(String url) {
        String h = host(url);
        String u = url == null ? "" : url.toLowerCase(Locale.US);
        return h.contains("short.icu")
                || h.contains("abyss")
                || h.contains("playm4u")
                || h.contains("hydrax")
                || h.contains("embed")
                || h.contains("player")
                || u.contains("/embed/")
                || u.contains("/player/")
                || u.contains("?v=");
    }

    private void inspectPlayerFrame(String frameUrl, String parentUrl, int depth) {
        inspectPlayerFrameFromRequest(frameUrl, parentUrl, new LinkedHashMap<>(), depth);
    }

    private void inspectPlayerFrameFromRequest(String frameUrl, String parentUrl,
                                               Map<String, String> originalHeaders,
                                               int depth) {
        if (depth > 2 || !isHttpUrl(frameUrl)) return;

        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(frameUrl).openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(10000);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept",
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            conn.setRequestProperty("Accept-Encoding", "identity");

            if (originalHeaders != null) {
                for (Map.Entry<String, String> e : originalHeaders.entrySet()) {
                    String k = e.getKey();
                    String v = e.getValue();
                    if (k == null || v == null) continue;
                    if ("Host".equalsIgnoreCase(k)
                            || "Connection".equalsIgnoreCase(k)
                            || "Content-Length".equalsIgnoreCase(k)
                            || "Accept-Encoding".equalsIgnoreCase(k)
                            || "Cookie".equalsIgnoreCase(k)
                            || "Range".equalsIgnoreCase(k)) continue;
                    try { conn.setRequestProperty(k, v); } catch (Exception ignored) {}
                }
            }

            if (webViewUserAgent != null && !webViewUserAgent.isEmpty()) {
                conn.setRequestProperty("User-Agent", webViewUserAgent);
            }
            if (parentUrl != null && isHttpUrl(parentUrl)) {
                conn.setRequestProperty("Referer", parentUrl);
            }

            String cookie = CookieManager.getInstance().getCookie(frameUrl);
            if (cookie != null && !cookie.isEmpty()) {
                conn.setRequestProperty("Cookie", cookie);
            }

            int code = conn.getResponseCode();
            if (code < 200 || code >= 400) {
                addDiagnostic("FRAME_FETCH code=" + code
                        + " url=" + redactUrl(frameUrl));
                return;
            }

            String finalUrl = conn.getURL().toString();
            String contentType = conn.getContentType();
            String html = readTextLimited(conn.getInputStream(), 2_000_000);
            addDiagnostic("FRAME_FETCH code=" + code
                    + " type=" + safeText(contentType)
                    + " bytes=" + html.length()
                    + " final=" + redactUrl(finalUrl));

            Matcher dataMatcher = Pattern.compile(
                    "(?is)(?:const|var)\\s+datas\\s*=\\s*[\"']([^\"']{50,})[\"']")
                    .matcher(html);
            if (dataMatcher.find()) {
                String encoded = dataMatcher.group(1);
                String key = Integer.toHexString(encoded.hashCode()) + ":" + encoded.length();
                if (processedAbyssDatas.add(key)) {
                    addDiagnostic("ABYSS_DATAS_NATIVE bytes=" + encoded.length()
                            + " frame=" + redactUrl(finalUrl));
                    extractAbyssSources(encoded, finalUrl);
                }
                return;
            }

            // Some hosts put the real player in another iframe. Follow a few likely
            // nested frames natively so cross-origin JS access is not required.
            Matcher iframeMatcher = Pattern.compile(
                    "(?is)<iframe[^>]+src\\s*=\\s*[\"']([^\"']+)[\"']")
                    .matcher(html);
            int followed = 0;
            while (iframeMatcher.find() && followed < 5) {
                String nested = resolveAgainst(
                        iframeMatcher.group(1).replace("&amp;", "&"),
                        finalUrl,
                        finalUrl);
                if (nested == null || !isHttpUrl(nested)) continue;
                if (!looksLikePlayerFrame(nested) && depth > 0) continue;

                if (processedPlayerFrames.add(nested)) {
                    followed++;
                    addDiagnostic("FRAME_NESTED depth=" + (depth + 1)
                            + " url=" + redactUrl(nested));
                    inspectPlayerFrameFromRequest(
                            nested, finalUrl, new LinkedHashMap<>(), depth + 1);
                }
            }
            if (followed == 0) {
                boolean hasSoTrym = html.contains("SoTrym");
                boolean hasIamCdn = html.contains("iamcdn.net");
                boolean hasJw = html.toLowerCase(Locale.US).contains("jwplayer");
                addDiagnostic("FRAME_NO_DATAS sotrym=" + hasSoTrym
                        + " iamcdn=" + hasIamCdn
                        + " jw=" + hasJw);
            }
        } catch (Exception e) {
            addDiagnostic("FRAME_FETCH_ERROR " + safeText(
                    e.getClass().getSimpleName() + ": " + e.getMessage())
                    + " url=" + redactUrl(frameUrl));
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private String readTextLimited(InputStream input, int maxBytes) throws Exception {
        try (InputStream in = new BufferedInputStream(input);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int total = 0;
            while (total < maxBytes) {
                int n = in.read(buffer, 0, Math.min(buffer.length, maxBytes - total));
                if (n < 0) break;
                out.write(buffer, 0, n);
                total += n;
            }
            return out.toString(StandardCharsets.UTF_8);
        }
    }

    private void extractAbyssSources(String encoded, String frameUrl) {
        try {
            byte[] outerBytes = Base64.decode(encoded, Base64.DEFAULT);
            String outerJson = new String(outerBytes, StandardCharsets.ISO_8859_1);
            JSONObject outer = new JSONObject(outerJson);

            String slug = outer.optString("slug", "");
            String md5Id = String.valueOf(outer.opt("md5_id"));
            String userId = String.valueOf(outer.opt("user_id"));
            String mediaEncrypted = outer.optString("media", "");

            if (slug.isEmpty() || md5Id.isEmpty() || userId.isEmpty() || mediaEncrypted.isEmpty()) {
                addDiagnostic("ABYSS_ERROR missing metadata");
                return;
            }

            byte[] encrypted = lowBytes(mediaEncrypted);
            byte[] decrypted = aesCtrTransform(encrypted, userId + ":" + slug + ":" + md5Id);
            if (decrypted == null || decrypted.length == 0) {
                addDiagnostic("ABYSS_ERROR decrypt failed");
                return;
            }

            String mediaJson = new String(decrypted, StandardCharsets.UTF_8);
            JSONObject media = new JSONObject(mediaJson);
            JSONObject mp4 = media.optJSONObject("mp4");
            if (mp4 == null) {
                addDiagnostic("ABYSS_ERROR no mp4 block");
                return;
            }

            JSONArray sources = mp4.optJSONArray("sources");
            JSONArray domains = mp4.optJSONArray("domains");
            if (sources == null || sources.length() == 0) {
                addDiagnostic("ABYSS_ERROR no sources");
                return;
            }

            int added = 0;
            for (int i = 0; i < sources.length(); i++) {
                JSONObject source = sources.optJSONObject(i);
                if (source == null) continue;
                if (source.has("status") && !source.optBoolean("status", true)) continue;

                String label = source.optString("label", "Quality " + (i + 1));
                String direct = source.optString("file", "");
                String url = source.optString("url", "");
                String path = source.optString("path", "");
                String resId = String.valueOf(source.opt("res_id"));
                String size = String.valueOf(source.opt("size"));
                String sub = source.optString("sub", "");

                long sizeBytes = parseLongSafe(size);
                if (sizeBytes <= 0) continue;

                String domain = findAbyssDomain(domains, sub);
                if (domain.isEmpty() && !sub.isEmpty()) {
                    domain = "https://" + sub + ".sssrr.org";
                }

                String sourceUrl = "";
                boolean virtualSegmented = false;

                if (!direct.isEmpty()) {
                    sourceUrl = direct.replace("\\/", "/");
                } else if (!url.isEmpty() && !path.isEmpty()) {
                    sourceUrl = url.replace("\\/", "/").replaceAll("/+$", "")
                            + "/" + path.replace("\\/", "/").replaceAll("^/+", "");
                } else if (!domain.isEmpty() && !resId.isEmpty()) {
                    String id = Integer.toHexString(
                            (slug + "|" + md5Id + "|" + resId + "|" + size + "|" + domain).hashCode());
                    sourceUrl = "https://webcast.local/abyss-media/" + id;
                    virtualSegmented = true;
                }

                if (!isHttpUrl(sourceUrl)) continue;

                Map<String, String> headers = new LinkedHashMap<>();
                String referer = refererRoot(frameUrl);
                if (referer.isEmpty()) referer = "https://abysscdn.com/";
                headers.put("Referer", referer);
                if (webViewUserAgent != null && !webViewUserAgent.isEmpty()) {
                    headers.put("User-Agent", webViewUserAgent);
                }
                synchronized (mediaRequestHeaders) {
                    mediaRequestHeaders.put(sourceUrl, headers);
                }

                String quality = cleanQualityLabel(label);
                if (virtualSegmented) {
                    headers.put("Referer", "https://abysscdn.com/");
                    synchronized (mediaRequestHeaders) {
                        mediaRequestHeaders.put(sourceUrl, new LinkedHashMap<>(headers));
                    }
                    List<String> mirrorHosts = collectAbyssHosts(domains, sub, domain);
                    abyssVirtualSources.put(
                            sourceUrl,
                            new AbyssVirtualSource(
                                    slug, md5Id, resId, sizeBytes, domain,
                                    quality, headers, mirrorHosts));
                }

                String sourceTag = "abyss-source|" + quality + "|" + sizeBytes
                        + (virtualSegmented ? "|virtual" : "|direct");
                addDetectedMedia(sourceUrl, "video/mp4", sourceTag, 140 + i);
                addDiagnostic("ABYSS_SOURCE quality=" + quality
                        + " size=" + sizeBytes
                        + " mode=" + (virtualSegmented ? "segmented" : "direct")
                        + " host=" + (virtualSegmented ? host(domain) : host(sourceUrl)));
                added++;
            }

            addDiagnostic("ABYSS_EXTRACTED sources=" + added
                    + " frame=" + redactUrl(frameUrl));
            runOnUiThread(this::updateStatus);
        } catch (Exception e) {
            addDiagnostic("ABYSS_ERROR " + safeText(e.getClass().getSimpleName()
                    + ": " + e.getMessage()));
        }
    }

    private byte[] lowBytes(String text) {
        byte[] out = new byte[text.length()];
        for (int i = 0; i < text.length(); i++) {
            out[i] = (byte) (text.charAt(i) & 0xff);
        }
        return out;
    }

    private byte[] deriveAbyssKey(String seed) throws Exception {
        String s = String.valueOf(seed);
        MessageDigest md5 = MessageDigest.getInstance("MD5");
        byte[] digest = md5.digest(s.getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder(32);
        for (byte b : digest) {
            hex.append(String.format(Locale.US, "%02x", b & 0xff));
        }
        return hex.toString().getBytes(StandardCharsets.UTF_8);
    }

    private byte[] aesCtrTransform(byte[] input, String keySeed) {
        try {
            byte[] key = deriveAbyssKey(keySeed);
            byte[] iv = new byte[16];
            System.arraycopy(key, 0, iv, 0, 16);

            Cipher cipher = Cipher.getInstance("AES/CTR/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,
                    new SecretKeySpec(key, "AES"),
                    new IvParameterSpec(iv));
            return cipher.doFinal(input);
        } catch (Exception e) {
            return null;
        }
    }

    private byte[] deriveSegmentKey(String sizeValue) throws Exception {
        String s = String.valueOf(sizeValue);
        ByteArrayOutputStream numeric = new ByteArrayOutputStream();
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (Character.isDigit(ch)) {
                // Abyss' browser code hashes numeric digit VALUES, not ASCII "0".."9".
                numeric.write(ch - '0');
            } else {
                numeric.write(ch & 0xff);
            }
        }

        MessageDigest md5 = MessageDigest.getInstance("MD5");
        byte[] digest = md5.digest(numeric.toByteArray());
        StringBuilder hex = new StringBuilder(32);
        for (byte b : digest) {
            hex.append(String.format(Locale.US, "%02x", b & 0xff));
        }
        return hex.toString().getBytes(StandardCharsets.UTF_8);
    }

    private byte[] aesCtrTransformSegment(byte[] input, String sizeValue) {
        try {
            byte[] key = deriveSegmentKey(sizeValue);
            byte[] iv = new byte[16];
            System.arraycopy(key, 0, iv, 0, 16);

            Cipher cipher = Cipher.getInstance("AES/CTR/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,
                    new SecretKeySpec(key, "AES"),
                    new IvParameterSpec(iv));
            return cipher.doFinal(input);
        } catch (Exception e) {
            return null;
        }
    }

    private String buildSoraToken(String pathValue, String sizeValue) {
        try {
            byte[] transformed = aesCtrTransformSegment(
                    pathValue.getBytes(StandardCharsets.UTF_8), sizeValue);
            if (transformed == null) return "";

            String first = Base64.encodeToString(transformed,
                    Base64.NO_WRAP | Base64.NO_PADDING);
            return Base64.encodeToString(first.getBytes(StandardCharsets.UTF_8),
                    Base64.NO_WRAP | Base64.NO_PADDING);
        } catch (Exception e) {
            return "";
        }
    }

    private String findAbyssDomain(JSONArray domains, String sub) {
        if (domains == null) return "";
        for (int i = 0; i < domains.length(); i++) {
            String d = domains.optString(i, "");
            if (d.isEmpty()) continue;
            if (!sub.isEmpty() && !d.contains(sub)) continue;
            if (!d.startsWith("http://") && !d.startsWith("https://")) d = "https://" + d;
            return d;
        }
        return "";
    }

    private List<String> collectAbyssHosts(JSONArray domains, String sub, String primaryDomain) {
        List<String> result = new ArrayList<>();

        String primaryHost = host(primaryDomain);
        if (!primaryHost.isEmpty()) result.add(primaryHost);

        String suffix = "";
        if (domains != null && domains.length() > 0) {
            String first = domains.optString(0, "");
            String firstHost = host(first.startsWith("http") ? first : "https://" + first);
            int dot = firstHost.indexOf('.');
            if (dot >= 0 && dot + 1 < firstHost.length()) {
                suffix = firstHost.substring(dot + 1);
            }
        }

        if (sub != null && !sub.isEmpty() && !suffix.isEmpty()) {
            String derived = sub + "." + suffix;
            if (!result.contains(derived)) result.add(0, derived);
        }

        if (domains != null) {
            for (int i = 0; i < domains.length(); i++) {
                String raw = domains.optString(i, "");
                if (raw.isEmpty()) continue;
                String h = host(raw.startsWith("http") ? raw : "https://" + raw);
                if (!h.isEmpty() && !result.contains(h)) result.add(h);
            }
        }

        if (result.isEmpty() && sub != null && !sub.isEmpty()) {
            result.add(sub + ".sssrr.org");
        }
        return result;
    }

    private String refererRoot(String frameUrl) {
        try {
            URI uri = new URI(frameUrl);
            if (uri.getScheme() == null || uri.getHost() == null) return "";
            return uri.getScheme() + "://" + uri.getHost() + "/";
        } catch (Exception ignored) {
            return "";
        }
    }

    private long parseLongSafe(String value) {
        try {
            if (value == null) return -1;
            String cleaned = value.replaceAll("[^0-9]", "");
            return cleaned.isEmpty() ? -1 : Long.parseLong(cleaned);
        } catch (Exception ignored) {
            return -1;
        }
    }

    private String cleanQualityLabel(String label) {
        if (label == null || label.trim().isEmpty()) return "Unknown";
        String l = label.trim();
        if (l.matches("\\d{3,4}")) return l + "p";
        return l;
    }

    private boolean containsMediaReference(String text) {
        if (text == null || text.isEmpty()) return false;
        String t = text.toLowerCase(Locale.US);
        return t.contains("#extm3u") || t.contains("<mpd")
                || t.contains(".m3u8") || t.contains(".mpd")
                || t.contains(".mp4") || t.contains(".m4v")
                || t.contains(".webm") || t.contains(".mov");
    }

    private void extractMediaUrlsFromText(String text, String sourceUrl, String frameUrl, String source) {
        if (text == null) return;
        String cleaned = text.replace("\\\\/", "/");

        Pattern absolute = Pattern.compile("https?://[^\\\\s\\\\\\\"'<>]+", Pattern.CASE_INSENSITIVE);
        Matcher matcher = absolute.matcher(cleaned);
        int found = 0;
        while (matcher.find() && found < 80) {
            String candidate = trimUrlPunctuation(matcher.group());
            if (isLikelyMediaReference(candidate)) {
                found++;
                queueOrAddExtracted(candidate, source);
            }
        }

        Pattern keyed = Pattern.compile(
                "(?i)(?:file|src|source|url|hls|playlist|manifest)\\\\s*[\\\\\\\"']?\\\\s*[:=]\\\\s*[\\\\\\\"']([^\\\\\\\"']+)[\\\\\\\"']");
        Matcher km = keyed.matcher(cleaned);
        while (km.find() && found < 100) {
            String value = km.group(1).replace("\\\\/", "/").trim();
            String resolved = resolveAgainst(value, sourceUrl, frameUrl);
            if (resolved != null && isLikelyMediaReference(resolved)) {
                found++;
                queueOrAddExtracted(resolved, source + "+key");
            }
        }

        if (found > 0) addDiagnostic("EXTRACTED " + found + " media URL(s) from " + source);
    }

    private void queueOrAddExtracted(String candidate, String source) {
        if (!isHttpUrl(candidate) || isSegmentLike(candidate) || isKnownAdUrl(candidate)) return;
        String mime = guessMime(candidate);
        int score = scoreCandidate(candidate, mime, "", "", "");
        if (score >= 90) addDetectedMedia(candidate, mime, source, Math.max(score, 112));
        else queueProbe(candidate, new LinkedHashMap<>(), source, true);
    }

    private boolean isLikelyMediaReference(String url) {
        if (url == null) return false;
        String u = url.toLowerCase(Locale.US);
        return u.contains(".m3u8") || u.contains(".mpd")
                || u.matches(".*\\\\.(mp4|m4v|webm|mov)(?:$|[?#/&]).*")
                || u.contains("/stream/") || u.contains("/playlist/")
                || u.contains("/manifest/");
    }

    private String resolveAgainst(String value, String sourceUrl, String frameUrl) {
        if (value == null || value.isEmpty()) return null;
        try {
            if (isHttpUrl(value)) return value;
            String base = isHttpUrl(sourceUrl) ? sourceUrl : frameUrl;
            if (!isHttpUrl(base)) return null;
            return new URI(base).resolve(value).toString();
        } catch (Exception ignored) {
            return null;
        }
    }

    private String trimUrlPunctuation(String value) {
        if (value == null) return "";
        String v = value;
        while (!v.isEmpty() && ")]},;".indexOf(v.charAt(v.length() - 1)) >= 0) {
            v = v.substring(0, v.length() - 1);
        }
        return v;
    }

    private void addDiagnostic(String event) {
        if (event == null || event.isEmpty()) return;
        synchronized (diagnosticLog) {
            diagnosticLog.add(event);
            while (diagnosticLog.size() > 120) diagnosticLog.remove(0);
        }
    }

    private String safeText(String value) {
        if (value == null) return "";
        String v = value.replace('\n', ' ').replace('\r', ' ').trim();
        return v.length() > 80 ? v.substring(0, 80) + "…" : v;
    }

    private String safeHeader(String value) {
        if (value == null) return "";
        String v = value.replace('\n', ' ').replace('\r', ' ').trim();
        return v.length() > 64 ? v.substring(0, 64) + "…" : v;
    }

    private String redactUrl(String raw) {
        if (raw == null || raw.isEmpty()) return "";
        if (raw.startsWith("blob:")) return "blob:" + host(raw.substring(5));
        try {
            URI uri = new URI(raw);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme() + "://";
            String h = uri.getHost() == null ? "" : uri.getHost();
            String p = uri.getPath() == null ? "" : uri.getPath();
            if (p.length() > 120) p = p.substring(0, 117) + "…";
            return scheme + h + p;
        } catch (Exception ignored) {
            return safeText(raw);
        }
    }

    private String redactPath(String raw) {
        try {
            URI uri = new URI(raw);
            String p = uri.getPath() == null ? "/" : uri.getPath();
            return p.length() > 100 ? p.substring(0, 97) + "…" : p;
        } catch (Exception ignored) {
            return "";
        }
    }

    private void showDebugReport() {
        StringBuilder sb = new StringBuilder();
        sb.append("WEBCAST_DEBUG_V0.7.2\\n");
        sb.append("page=").append(redactUrl(webView == null ? "" : webView.getUrl())).append("\\n");
        sb.append("title=").append(safeText(webView == null ? "" : webView.getTitle())).append("\\n");
        sb.append("confirmedVideos=").append(getDisplayMedia().size()).append("\\n");
        sb.append("rawRequests=").append(rawRequests.size()).append("\\n");
        sb.append("activeProbes=").append(activeProbes.get()).append("\\n");
        sb.append("blobHlsDash=").append(blobHlsHits.get()).append("\\n");
        sb.append("blobVideo=").append(blobVideoHits.get()).append("\\n");
        sb.append("mediaSource=").append(mseHits.get()).append("\\n");
        sb.append("blockedAds=").append(blockedAds).append("\\n");
        sb.append("detectorEvents=").append(detectorEvents).append("\\n\\n");

        List<String> logs;
        synchronized (diagnosticLog) {
            logs = new ArrayList<>(diagnosticLog);
        }
        int start = Math.max(0, logs.size() - 80);
        for (int i = start; i < logs.size(); i++) {
            sb.append(logs.get(i)).append("\\n");
        }

        final String report = sb.toString();
        new AlertDialog.Builder(this)
                .setTitle("WebCast Debug")
                .setMessage(report)
                .setPositiveButton("Copy", (dialog, which) -> {
                    ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                    if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("WebCast Debug", report));
                    Toast.makeText(this, "Debug report copied.", Toast.LENGTH_SHORT).show();
                })
                .setNeutralButton("Deep Scan", (dialog, which) -> deepProbeCapturedRequests())
                .setNegativeButton("Close", null)
                .show();
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
        return "";
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
        list.removeIf(m -> isSegmentLike(m.url) || isKnownAdUrl(m.url));
        list.sort(Comparator
                .comparingInt((DetectedMedia m) -> displayRank(m)).reversed()
                .thenComparingInt(m -> priority(m.mime))
                .thenComparingInt(m -> m.url.length()));
        return list;
    }

    private List<DetectedMedia> getDisplayMedia() {
        List<DetectedMedia> all = getSortedMedia();
        if (all.isEmpty()) return all;

        // Once the player metadata has been decoded, these are the real complete
        // quality sources. Hide the service-worker chunk URLs from the normal list.
        List<DetectedMedia> abyss = new ArrayList<>();
        for (DetectedMedia m : all) {
            if (m.source != null && m.source.startsWith("abyss-source|")) abyss.add(m);
        }
        if (!abyss.isEmpty()) {
            abyss.sort((a, b) -> Long.compare(qualitySize(b), qualitySize(a)));
            return abyss;
        }

        // Ranged service-worker files are quality variants of the same logical movie.
        // Only show the variant most recently requested by the visible player.
        if (lastRangeVideoUrl != null && !lastRangeVideoUrl.isEmpty()) {
            for (DetectedMedia m : all) {
                if (lastRangeVideoUrl.equals(m.url)
                        && m.source != null && m.source.contains("range-video")) {
                    return Collections.singletonList(m);
                }
            }
        }

        // A direct URL attached to the actual media element is the strongest signal.
        for (DetectedMedia m : all) {
            if (isDirectMedia(m) && isDomMediaSource(m.source)) {
                return Collections.singletonList(m);
            }
        }

        // Adaptive players often expose dozens of fragments plus several variant playlists.
        // Present one root HLS and one root DASH candidate rather than every rendition.
        DetectedMedia bestHls = null;
        DetectedMedia bestDash = null;
        List<DetectedMedia> direct = new ArrayList<>();

        for (DetectedMedia m : all) {
            if (isHls(m)) {
                if (bestHls == null || displayRank(m) > displayRank(bestHls)) bestHls = m;
            } else if (isDash(m)) {
                if (bestDash == null || displayRank(m) > displayRank(bestDash)) bestDash = m;
            } else if (isDirectMedia(m)) {
                direct.add(m);
            }
        }

        List<DetectedMedia> result = new ArrayList<>();
        if (bestHls != null) result.add(bestHls);
        if (bestDash != null) result.add(bestDash);

        // If we found an adaptive root, it is normally the one playable video.
        if (!result.isEmpty()) return result;

        // For progressive media, suppress duplicate-looking CDNs/range URLs and show only
        // the best few genuinely distinct files.
        Map<String, DetectedMedia> groups = new LinkedHashMap<>();
        for (DetectedMedia m : direct) {
            String key = mediaFamilyKey(m.url);
            DetectedMedia old = groups.get(key);
            if (old == null || displayRank(m) > displayRank(old)) groups.put(key, m);
        }

        result.addAll(groups.values());
        result.sort(Comparator.comparingInt((DetectedMedia m) -> displayRank(m)).reversed());
        if (result.size() > 4) return new ArrayList<>(result.subList(0, 4));
        return result;
    }

    private long qualitySize(DetectedMedia m) {
        if (m == null || m.source == null) return -1;
        if (m.source.startsWith("abyss-source|")) {
            String[] parts = m.source.split("\\|");
            if (parts.length >= 3) return parseLongSafe(parts[2]);
        }
        return m.estimatedSizeBytes;
    }

    private boolean isHls(DetectedMedia m) {
        String mime = m.mime == null ? "" : m.mime.toLowerCase(Locale.US);
        String url = m.url.toLowerCase(Locale.US);
        return mime.contains("mpegurl") || url.contains(".m3u8");
    }

    private boolean isDash(DetectedMedia m) {
        String mime = m.mime == null ? "" : m.mime.toLowerCase(Locale.US);
        String url = m.url.toLowerCase(Locale.US);
        return mime.contains("dash") || url.contains(".mpd");
    }

    private boolean isDirectMedia(DetectedMedia m) {
        if (isHls(m) || isDash(m) || isSegmentLike(m.url)) return false;
        String mime = m.mime == null ? "" : m.mime.toLowerCase(Locale.US);
        String url = m.url.toLowerCase(Locale.US);
        return mime.startsWith("video/")
                || url.matches(".*\\\\.(mp4|m4v|webm|mov)(?:$|[?#/]).*");
    }

    private boolean isDomMediaSource(String source) {
        if (source == null) return false;
        return source.contains("dom-media") || source.contains("dom-source") || source.contains("page");
    }

    private int displayRank(DetectedMedia m) {
        int rank = m.score;
        String u = m.url.toLowerCase(Locale.US);
        String s = m.source == null ? "" : m.source.toLowerCase(Locale.US);

        if (s.contains("range-video")) rank += 45;
        if (s.contains("dom-media")) rank += 35;
        else if (s.contains("dom-source")) rank += 28;
        else if (s.contains("fetch") || s.contains("xhr")) rank += 15;
        else if (s.contains("script-config")) rank += 8;

        if (u.contains("master")) rank += 30;
        else if (u.contains("manifest")) rank += 24;
        else if (u.contains("playlist")) rank += 18;
        else if (u.contains("index.m3u8")) rank += 12;

        // Variant playlists often advertise their resolution/bitrate in the URL.
        if (u.matches(".*(?:^|[/_.-])(144|240|360|480|540|720|1080|1440|2160)p?(?:[/_.?&=-]|$).*")) rank -= 12;
        if (u.matches(".*(?:^|[/_.-])(low|medium|high|mobile)(?:[/_.?&=-]|$).*")) rank -= 6;

        return rank;
    }

    private String mediaFamilyKey(String rawUrl) {
        try {
            URI uri = new URI(rawUrl);
            String h = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.US);
            String p = uri.getPath() == null ? "" : uri.getPath().toLowerCase(Locale.US);
            String file = p.substring(p.lastIndexOf('/') + 1);
            // Strip common CDN/rendition tokens while keeping the actual filename family.
            file = file.replaceAll("(?i)(?:^|[-_.])(144|240|360|480|540|720|1080|1440|2160)p?(?=[-_.]|$)", "");
            file = file.replaceAll("(?i)(?:^|[-_.])(low|medium|high|mobile)(?=[-_.]|$)", "");
            return h + "|" + file;
        } catch (Exception ignored) {
            return rawUrl;
        }
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
        List<DetectedMedia> list = getDisplayMedia();
        if (list.isEmpty()) {
            injectPageHelpers(webView);
            int rawCount = rawRequests.size();
            new AlertDialog.Builder(this)
                    .setTitle("No confirmed video yet")
                    .setMessage(rawCount + " recent network requests captured. Deep Scan checks their real server responses to find the playable stream.")
                    .setPositiveButton("Deep Scan", (dialog, which) -> deepProbeCapturedRequests())
                    .setNeutralButton("Debug", (dialog, which) -> showDebugReport())
                    .setNegativeButton("Close", null)
                    .show();
            return;
        }

        String[] labels = new String[list.size()];
        for (int i = 0; i < list.size(); i++) labels[i] = list.get(i).displayLabel();

        new AlertDialog.Builder(this)
                .setTitle("Detected videos")
                .setItems(labels, (dialog, which) -> castMedia(list.get(which)))
                .setNeutralButton("All candidates (" + getSortedMedia().size() + ")", (dialog, which) ->
                        showAllCandidates())
                .setNegativeButton("Close", null)
                .show();
    }

    private void showAllCandidates() {
        List<DetectedMedia> all = getSortedMedia();
        if (all.isEmpty()) {
            Toast.makeText(this, "No raw candidates.", Toast.LENGTH_SHORT).show();
            return;
        }
        String[] labels = new String[all.size()];
        for (int i = 0; i < all.size(); i++) labels[i] = all.get(i).displayLabel();

        new AlertDialog.Builder(this)
                .setTitle("All media candidates")
                .setItems(labels, (dialog, which) -> castMedia(all.get(which)))
                .setNeutralButton("Clear", (dialog, which) -> {
                    detectedMedia.clear();
                    updateStatus();
                })
                .setNegativeButton("Close", null)
                .show();
    }

    private void castMedia(@NonNull DetectedMedia media) {
        if (media.source != null
                && (media.source.contains("range-video")
                || media.source.startsWith("abyss-source|"))) {
            castMediaViaPhone(media);
            return;
        }

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

    private void pausePhonePlaybackForCast() {
        pauseLocalForCast = true;
        runOnUiThread(() -> {
            try {
                webView.evaluateJavascript(
                        "(function(){try{document.querySelectorAll('video,audio').forEach(function(v){v.pause();});"
                                + "if(window.jwplayer&&typeof jwplayer().pause==='function')jwplayer().pause(true);"
                                + "}catch(e){}})();",
                        null);
            } catch (Exception ignored) {
            }
        });
        addDiagnostic("PHONE_PLAYBACK_PAUSE requested");
    }

    private void castMediaViaPhone(@NonNull DetectedMedia media) {
        pausePhonePlaybackForCast();

        CastSession session = castContext.getSessionManager().getCurrentCastSession();
        if (session == null || !session.isConnected()) {
            Toast.makeText(this, "Tap the Cast icon and connect to a Chromecast first.",
                    Toast.LENGTH_LONG).show();
            return;
        }

        RemoteMediaClient client = session.getRemoteMediaClient();
        if (client == null) {
            Toast.makeText(this, "Chromecast media channel is not ready.",
                    Toast.LENGTH_LONG).show();
            return;
        }

        try {
            RelayServer server = ensureRelayServer();
            if (server == null) {
                Toast.makeText(this,
                        "Could not start the phone relay. Make sure the phone is on the same Wi-Fi as the Chromecast.",
                        Toast.LENGTH_LONG).show();
                return;
            }

            Map<String, String> headers = new LinkedHashMap<>();
            synchronized (mediaRequestHeaders) {
                Map<String, String> saved = mediaRequestHeaders.get(media.url);
                if (saved != null) headers.putAll(saved);
            }

            String pageReferer = prefs == null ? "" : prefs.getString(KEY_LAST_URL, "");
            AbyssVirtualSource virtual = abyssVirtualSources.get(media.url);
            String token = virtual != null
                    ? server.registerAbyss(virtual, media.mime, pageReferer)
                    : server.register(media.url, headers, media.mime, pageReferer);
            String relayUrl = server.urlFor(token);

            acquireRelayWakeLock();
            addDiagnostic("CAST_RELAY source=" + redactUrl(media.url)
                    + " local=" + server.describe());

            MediaMetadata metadata = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MOVIE);
            String title = webView.getTitle();
            metadata.putString(MediaMetadata.KEY_TITLE,
                    title == null || title.trim().isEmpty() ? "Web video" : title);
            metadata.putString(MediaMetadata.KEY_SUBTITLE,
                    currentQualityLabel(media) + " • via phone");

            MediaInfo mediaInfo = new MediaInfo.Builder(relayUrl)
                    .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                    .setContentType(media.mime == null || media.mime.isEmpty()
                            ? "video/mp4" : media.mime)
                    .setMetadata(metadata)
                    .build();

            client.load(new MediaLoadRequestData.Builder()
                    .setMediaInfo(mediaInfo)
                    .setAutoplay(true)
                    .build());

            Toast.makeText(this,
                    "Casting current quality through phone…",
                    Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            addDiagnostic("RELAY_START_ERROR " + safeText(e.getClass().getSimpleName()
                    + ": " + e.getMessage()));
            Toast.makeText(this, "Phone relay could not start.", Toast.LENGTH_LONG).show();
        }
    }

    private RelayServer ensureRelayServer() {
        try {
            String ip = getLanIpv4Address();
            if (ip == null || ip.isEmpty()) return null;

            if (relayServer != null && relayServer.isRunning()
                    && ip.equals(relayServer.getBindAddress())) {
                return relayServer;
            }

            stopRelayServer();
            relayServer = new RelayServer(ip);
            relayServer.start();
            addDiagnostic("RELAY_START address=" + relayServer.describe());
            return relayServer;
        } catch (Exception e) {
            addDiagnostic("RELAY_START_ERROR " + safeText(e.getMessage()));
            return null;
        }
    }

    private void stopRelayServer() {
        RelayServer server = relayServer;
        relayServer = null;
        if (server != null) server.stop();
    }

    private String getLanIpv4Address() {
        try {
            ConnectivityManager cm =
                    (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return null;
            Network active = cm.getActiveNetwork();
            if (active == null) return null;
            LinkProperties props = cm.getLinkProperties(active);
            if (props == null) return null;

            for (LinkAddress link : props.getLinkAddresses()) {
                InetAddress address = link.getAddress();
                if (address instanceof Inet4Address
                        && !address.isLoopbackAddress()
                        && address.isSiteLocalAddress()) {
                    return address.getHostAddress();
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private void acquireRelayWakeLock() {
        try {
            if (relayWakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    relayWakeLock = pm.newWakeLock(
                            PowerManager.PARTIAL_WAKE_LOCK, "WebCast:PhoneRelay");
                    relayWakeLock.setReferenceCounted(false);
                }
            }
            if (relayWakeLock != null && !relayWakeLock.isHeld()) {
                relayWakeLock.acquire(2L * 60L * 60L * 1000L);
            }
        } catch (Exception ignored) {
        }
    }

    private void releaseRelayWakeLock() {
        try {
            if (relayWakeLock != null && relayWakeLock.isHeld()) relayWakeLock.release();
        } catch (Exception ignored) {
        }
    }

    private String currentQualityLabel(DetectedMedia media) {
        long bytes = media.estimatedSizeBytes;
        if (bytes > 0) return "Current quality • " + formatBytes(bytes);
        return "Current quality";
    }

    private long parseEstimatedSizeFromUrl(String rawUrl) {
        if (rawUrl == null) return -1;
        try {
            String path = new URI(rawUrl).getPath();
            if (path == null) return -1;
            Matcher m = Pattern.compile("\\.([0-9]{7,})\\.\\d+\\.fd$", Pattern.CASE_INSENSITIVE)
                    .matcher(path);
            if (m.find()) return Long.parseLong(m.group(1));
        } catch (Exception ignored) {
        }
        return -1;
    }

    private String formatBytes(long bytes) {
        if (bytes <= 0) return "";
        double gb = bytes / (1024.0 * 1024.0 * 1024.0);
        if (gb >= 0.95) return String.format(Locale.US, "%.2f GB", gb);
        double mb = bytes / (1024.0 * 1024.0);
        return String.format(Locale.US, "%.0f MB", mb);
    }

    private class RelayServer {
        private final String bindAddress;
        private final Map<String, RelayTarget> targets =
                Collections.synchronizedMap(new LinkedHashMap<>());
        private final ExecutorService clients = Executors.newCachedThreadPool();
        private final ExecutorService segmentPool = Executors.newFixedThreadPool(4);
        private final Map<String, byte[]> segmentCache =
                Collections.synchronizedMap(new LinkedHashMap<String, byte[]>(20, 0.75f, true) {
                    @Override
                    protected boolean removeEldestEntry(Map.Entry<String, byte[]> eldest) {
                        return size() > 16;
                    }
                });
        private final AtomicBoolean running = new AtomicBoolean(false);
        private ServerSocket serverSocket;
        private Thread acceptThread;

        RelayServer(String bindAddress) {
            this.bindAddress = bindAddress;
        }

        void start() throws Exception {
            InetAddress bind = InetAddress.getByName(bindAddress);
            serverSocket = new ServerSocket(0, 24, bind);
            running.set(true);
            acceptThread = new Thread(() -> {
                while (running.get()) {
                    try {
                        Socket socket = serverSocket.accept();
                        clients.execute(() -> handleClient(socket));
                    } catch (Exception e) {
                        if (running.get()) {
                            addDiagnostic("RELAY_ACCEPT_ERROR " + safeText(e.getMessage()));
                        }
                    }
                }
            }, "WebCast-Relay-Accept");
            acceptThread.setDaemon(true);
            acceptThread.start();
        }

        boolean isRunning() {
            return running.get() && serverSocket != null && !serverSocket.isClosed();
        }

        String getBindAddress() {
            return bindAddress;
        }

        String register(String remoteUrl, Map<String, String> headers,
                        String mime, String referer) {
            String token = UUID.randomUUID().toString().replace("-", "");
            targets.put(token, new RelayTarget(remoteUrl, headers, mime, referer));
            return token;
        }

        String registerAbyss(AbyssVirtualSource source, String mime, String referer) {
            String token = UUID.randomUUID().toString().replace("-", "");
            targets.put(token, new RelayTarget(
                    "abyss-virtual://" + source.quality,
                    source.headers,
                    mime,
                    referer,
                    source));
            return token;
        }

        String urlFor(String token) {
            return "http://" + bindAddress + ":" + serverSocket.getLocalPort()
                    + "/media/" + token;
        }

        String describe() {
            if (!isRunning()) return "off";
            return bindAddress + ":" + serverSocket.getLocalPort();
        }

        void stop() {
            running.set(false);
            try {
                if (serverSocket != null) serverSocket.close();
            } catch (Exception ignored) {
            }
            clients.shutdownNow();
            segmentPool.shutdownNow();
            segmentCache.clear();
        }

        private void handleClient(Socket socket) {
            HttpURLConnection upstream = null;
            try (Socket s = socket) {
                s.setSoTimeout(20000);
                InputStream in = s.getInputStream();
                OutputStream out = s.getOutputStream();

                String requestLine = readHttpLine(in);
                if (requestLine == null || requestLine.isEmpty()) return;
                String[] parts = requestLine.split(" ");
                if (parts.length < 2) {
                    writeSimpleResponse(out, 400, "Bad Request");
                    return;
                }

                String method = parts[0].toUpperCase(Locale.US);
                String path = parts[1];

                Map<String, String> incoming = new LinkedHashMap<>();
                String line;
                while ((line = readHttpLine(in)) != null && !line.isEmpty()) {
                    int colon = line.indexOf(':');
                    if (colon > 0) {
                        incoming.put(line.substring(0, colon).trim(),
                                line.substring(colon + 1).trim());
                    }
                }

                if ("OPTIONS".equals(method)) {
                    writeOptionsResponse(out);
                    return;
                }

                if (!("GET".equals(method) || "HEAD".equals(method))) {
                    writeSimpleResponse(out, 405, "Method Not Allowed");
                    return;
                }

                String prefix = "/media/";
                if (!path.startsWith(prefix)) {
                    writeSimpleResponse(out, 404, "Not Found");
                    return;
                }

                String token = path.substring(prefix.length());
                int q = token.indexOf('?');
                if (q >= 0) token = token.substring(0, q);

                RelayTarget target = targets.get(token);
                if (target == null) {
                    writeSimpleResponse(out, 404, "Not Found");
                    return;
                }

                String incomingRange = findHeader(incoming, "Range");
                addDiagnostic("RELAY_CLIENT method=" + method
                        + " range=" + safeHeader(incomingRange)
                        + (target.abyss != null ? " abyss=" + target.abyss.quality : ""));

                if (target.abyss != null) {
                    handleAbyssVirtual(out, method, incomingRange, target);
                    return;
                }

                upstream = (HttpURLConnection) new URL(target.remoteUrl).openConnection();
                upstream.setInstanceFollowRedirects(true);
                upstream.setConnectTimeout(10000);
                upstream.setReadTimeout(30000);
                upstream.setRequestMethod(method);
                upstream.setRequestProperty("Accept-Encoding", "identity");

                for (Map.Entry<String, String> e : target.headers.entrySet()) {
                    String k = e.getKey();
                    String v = e.getValue();
                    if (k == null || v == null) continue;
                    if (isHopByHopHeader(k) || "Range".equalsIgnoreCase(k)
                            || "Cookie".equalsIgnoreCase(k)
                            || "Content-Length".equalsIgnoreCase(k)) continue;
                    try {
                        upstream.setRequestProperty(k, v);
                    } catch (Exception ignored) {
                    }
                }

                if (incomingRange != null && !incomingRange.isEmpty()) {
                    upstream.setRequestProperty("Range", incomingRange);
                }

                String cookie = CookieManager.getInstance().getCookie(target.remoteUrl);
                if (cookie != null && !cookie.isEmpty()) {
                    upstream.setRequestProperty("Cookie", cookie);
                }

                if (upstream.getRequestProperty("Referer") == null
                        && target.referer != null && isHttpUrl(target.referer)) {
                    upstream.setRequestProperty("Referer", target.referer);
                }

                if (upstream.getRequestProperty("User-Agent") == null
                        && webViewUserAgent != null && !webViewUserAgent.isEmpty()) {
                    upstream.setRequestProperty("User-Agent", webViewUserAgent);
                }

                int code = upstream.getResponseCode();
                String contentType = upstream.getContentType();
                String contentRange = upstream.getHeaderField("Content-Range");
                long contentLength = upstream.getHeaderFieldLong("Content-Length", -1L);
                String acceptRanges = upstream.getHeaderField("Accept-Ranges");

                addDiagnostic("RELAY_UPSTREAM code=" + code
                        + " type=" + safeText(contentType)
                        + " len=" + contentLength
                        + " contentRange=" + safeHeader(contentRange));

                writeStatusLine(out, code);
                writeHeader(out, "Content-Type",
                        contentType == null || contentType.isEmpty()
                                ? (target.mime == null || target.mime.isEmpty()
                                ? "video/mp4" : target.mime)
                                : normalizeContentType(contentType));
                if (contentLength >= 0) {
                    writeHeader(out, "Content-Length", String.valueOf(contentLength));
                }
                if (contentRange != null && !contentRange.isEmpty()) {
                    writeHeader(out, "Content-Range", contentRange);
                }
                writeHeader(out, "Accept-Ranges",
                        acceptRanges == null || acceptRanges.isEmpty() ? "bytes" : acceptRanges);
                writeHeader(out, "Access-Control-Allow-Origin", "*");
                writeHeader(out, "Access-Control-Allow-Headers", "Range, Content-Type");
                writeHeader(out, "Access-Control-Expose-Headers",
                        "Content-Length, Content-Range, Accept-Ranges");
                writeHeader(out, "Connection", "close");
                out.write("\r\n".getBytes(StandardCharsets.ISO_8859_1));
                out.flush();

                if ("HEAD".equals(method)) return;

                InputStream upstreamBody =
                        code >= 400 ? upstream.getErrorStream() : upstream.getInputStream();
                if (upstreamBody == null) return;

                try (InputStream body = new BufferedInputStream(upstreamBody)) {
                    byte[] buffer = new byte[64 * 1024];
                    int n;
                    while ((n = body.read(buffer)) >= 0) {
                        out.write(buffer, 0, n);
                    }
                    out.flush();
                }
            } catch (Exception e) {
                addDiagnostic("RELAY_ERROR " + safeText(e.getClass().getSimpleName()
                        + ": " + e.getMessage()));
            } finally {
                if (upstream != null) upstream.disconnect();
            }
        }

        private void handleAbyssVirtual(OutputStream out, String method,
                                        String rangeHeader, RelayTarget target) throws Exception {
            AbyssVirtualSource source = target.abyss;
            long total = source.totalSize;
            if (total <= 0) {
                writeSimpleResponse(out, 502, "Invalid media size");
                return;
            }

            long start = 0;
            long end = total - 1;
            boolean ranged = rangeHeader != null && !rangeHeader.isEmpty();

            if (ranged) {
                Matcher m = Pattern.compile("(?i)bytes=(\\d+)-(\\d*)")
                        .matcher(rangeHeader.trim());
                if (!m.find()) {
                    writeSimpleResponse(out, 416, "Range Not Satisfiable");
                    return;
                }
                start = Long.parseLong(m.group(1));
                if (m.group(2) != null && !m.group(2).isEmpty()) {
                    end = Math.min(total - 1, Long.parseLong(m.group(2)));
                }
                if (start >= total || end < start) {
                    writeStatusLine(out, 416);
                    writeHeader(out, "Content-Range", "bytes */" + total);
                    writeHeader(out, "Content-Length", "0");
                    writeHeader(out, "Connection", "close");
                    out.write("\r\n".getBytes(StandardCharsets.ISO_8859_1));
                    out.flush();
                    return;
                }
            }

            long length = end - start + 1;
            writeStatusLine(out, ranged ? 206 : 200);
            writeHeader(out, "Content-Type", "video/mp4");
            writeHeader(out, "Content-Length", String.valueOf(length));
            writeHeader(out, "Accept-Ranges", "bytes");
            if (ranged) {
                writeHeader(out, "Content-Range",
                        "bytes " + start + "-" + end + "/" + total);
            }
            writeHeader(out, "Access-Control-Allow-Origin", "*");
            writeHeader(out, "Access-Control-Allow-Headers", "Range, Content-Type");
            writeHeader(out, "Access-Control-Expose-Headers",
                    "Content-Length, Content-Range, Accept-Ranges");
            writeHeader(out, "Connection", "close");
            out.write("\r\n".getBytes(StandardCharsets.ISO_8859_1));
            out.flush();

            addDiagnostic("ABYSS_RELAY range=" + start + "-" + end + "/" + total
                    + " quality=" + source.quality);

            if ("HEAD".equals(method)) return;

            long segmentSize = AbyssVirtualSource.SEGMENT_SIZE;
            long firstSegment = start / segmentSize;
            long lastSegment = end / segmentSize;
            final int prefetchWindow = 4;

            Map<Long, Future<byte[]>> pending = new LinkedHashMap<>();
            for (long p = firstSegment;
                 p <= lastSegment && p < firstSegment + prefetchWindow; p++) {
                final long partNumber = p;
                pending.put(partNumber,
                        segmentPool.submit(() -> fetchAbyssSegmentBytes(source, partNumber)));
            }

            try {
                for (long part = firstSegment; part <= lastSegment; part++) {
                    Future<byte[]> future = pending.remove(part);
                    if (future == null) {
                        final long partNumber = part;
                        future = segmentPool.submit(
                                () -> fetchAbyssSegmentBytes(source, partNumber));
                    }

                    byte[] segment;
                    try {
                        segment = future.get();
                    } catch (ExecutionException e) {
                        Throwable cause = e.getCause();
                        if (cause instanceof Exception) throw (Exception) cause;
                        throw new IllegalStateException(cause);
                    }

                    long next = part + prefetchWindow;
                    if (next <= lastSegment && !pending.containsKey(next)) {
                        final long nextPart = next;
                        pending.put(nextPart,
                                segmentPool.submit(() -> fetchAbyssSegmentBytes(source, nextPart)));
                    }

                    long segmentGlobalStart = part * segmentSize;
                    int from = (int) (Math.max(start, segmentGlobalStart) - segmentGlobalStart);
                    long segmentGlobalEnd = Math.min(total - 1,
                            segmentGlobalStart + segment.length - 1);
                    int to = (int) (Math.min(end, segmentGlobalEnd) - segmentGlobalStart);
                    if (to < from) continue;

                    try {
                        out.write(segment, from, to - from + 1);
                        if ((part - firstSegment) % 4 == 0) out.flush();
                    } catch (java.io.IOException e) {
                        addDiagnostic("RELAY_CLIENT_CLOSED atPart=" + part
                                + " message=" + safeText(e.getMessage()));
                        break;
                    }
                }
                try { out.flush(); } catch (java.io.IOException ignored) {}
            } finally {
                for (Future<byte[]> future : pending.values()) {
                    future.cancel(true);
                }
            }
        }

        private String buildAbyssSegmentUrl(AbyssVirtualSource source,
                                                   long part, String hostName) {
            try {
                String h = hostName == null ? "" : hostName.trim();
                if (h.startsWith("http://") || h.startsWith("https://")) {
                    h = host(h);
                }
                if (h.isEmpty()) return "";

                String pathname = "/mp4/" + source.md5Id + "/" + source.resId
                        + "/" + source.totalSize + "/" + AbyssVirtualSource.SEGMENT_SIZE;
                String plain = pathname + "/" + part;
                String token = buildSoraToken(plain, String.valueOf(source.totalSize));
                if (token.isEmpty()) return "";

                if (part == 0) {
                    addDiagnostic("ABYSS_SEGMENT_ROUTE host=" + h
                            + " res=" + source.resId
                            + " size=" + source.totalSize
                            + " partSize=" + AbyssVirtualSource.SEGMENT_SIZE);
                }
                return "https://" + h + "/sora/" + source.totalSize + "/" + token;
            } catch (Exception e) {
                addDiagnostic("ABYSS_SEGMENT_URL_ERROR " + safeText(e.getMessage()));
                return "";
            }
        }

        private String abyssSegmentCacheKey(AbyssVirtualSource source, long part) {
            return source.md5Id + "|" + source.resId + "|" + source.totalSize + "|" + part;
        }

        private byte[] fetchAbyssSegmentBytes(AbyssVirtualSource source, long part)
                throws Exception {
            String cacheKey = abyssSegmentCacheKey(source, part);
            byte[] cached;
            synchronized (segmentCache) {
                cached = segmentCache.get(cacheKey);
            }
            if (cached != null) {
                addDiagnostic("ABYSS_CACHE_HIT part=" + part);
                return cached;
            }

            long expectedLong = Math.min(
                    AbyssVirtualSource.SEGMENT_SIZE,
                    source.totalSize - part * AbyssVirtualSource.SEGMENT_SIZE);
            if (expectedLong <= 0 || expectedLong > Integer.MAX_VALUE) {
                throw new IllegalStateException("invalid segment size for part " + part);
            }
            int expected = (int) expectedLong;

            List<String> hosts = source.hosts == null
                    ? Collections.emptyList() : source.hosts;
            if (hosts.isEmpty()) {
                String fallback = host(source.domain);
                if (fallback.isEmpty()) fallback = source.domain;
                hosts = Collections.singletonList(fallback);
            }

            Exception lastError = null;
            int attempts = Math.min(hosts.size() + 2, 7);

            for (int attempt = 0; attempt < attempts; attempt++) {
                String candidateHost = hosts.get(attempt % hosts.size());
                String segmentUrl = buildAbyssSegmentUrl(source, part, candidateHost);
                if (segmentUrl.isEmpty()) continue;

                HttpURLConnection conn = null;
                try {
                    conn = (HttpURLConnection) new URL(segmentUrl).openConnection();
                    conn.setInstanceFollowRedirects(true);
                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(30000);
                    conn.setRequestMethod("GET");
                    conn.setRequestProperty("Accept-Encoding", "identity");

                    for (Map.Entry<String, String> e : source.headers.entrySet()) {
                        String k = e.getKey();
                        String v = e.getValue();
                        if (k == null || v == null) continue;
                        if ("Host".equalsIgnoreCase(k)
                                || "Connection".equalsIgnoreCase(k)
                                || "Content-Length".equalsIgnoreCase(k)
                                || "Accept-Encoding".equalsIgnoreCase(k)
                                || "Range".equalsIgnoreCase(k)) continue;
                        try { conn.setRequestProperty(k, v); } catch (Exception ignored) {}
                    }

                    conn.setRequestProperty("Referer", "https://abysscdn.com/");
                    if (conn.getRequestProperty("User-Agent") == null
                            && webViewUserAgent != null && !webViewUserAgent.isEmpty()) {
                        conn.setRequestProperty("User-Agent", webViewUserAgent);
                    }

                    int code = conn.getResponseCode();
                    if (code != 200 && code != 206) {
                        throw new IllegalStateException(
                                "segment " + part + " HTTP " + code + " host=" + candidateHost);
                    }

                    ByteArrayOutputStream bytes = new ByteArrayOutputStream(expected);
                    try (InputStream body = new BufferedInputStream(conn.getInputStream())) {
                        byte[] buffer = new byte[64 * 1024];
                        int totalRead = 0;
                        while (totalRead < expected) {
                            int want = Math.min(buffer.length, expected - totalRead);
                            int n = body.read(buffer, 0, want);
                            if (n < 0) break;
                            bytes.write(buffer, 0, n);
                            totalRead += n;
                        }

                        if (totalRead != expected) {
                            throw new IllegalStateException(
                                    "segment " + part + " short read "
                                            + totalRead + "/" + expected);
                        }
                    }

                    byte[] result = bytes.toByteArray();
                    synchronized (segmentCache) {
                        segmentCache.put(cacheKey, result);
                    }

                    if (attempt > 0) {
                        addDiagnostic("ABYSS_MIRROR_RECOVER part=" + part
                                + " attempt=" + (attempt + 1)
                                + " host=" + candidateHost);
                    } else {
                        addDiagnostic("ABYSS_SEGMENT part=" + part
                                + " bytes=" + result.length);
                    }
                    return result;
                } catch (Exception e) {
                    lastError = e;
                    addDiagnostic("ABYSS_SEGMENT_RETRY part=" + part
                            + " attempt=" + (attempt + 1)
                            + " host=" + candidateHost
                            + " reason=" + safeText(e.getMessage()));
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }

            if (lastError != null) throw lastError;
            throw new IllegalStateException("segment " + part + " failed");
        }

        private String readHttpLine(InputStream in) throws Exception {
            ByteArrayOutputStream line = new ByteArrayOutputStream();
            int prev = -1;
            int b;
            while ((b = in.read()) != -1) {
                if (prev == '\r' && b == '\n') {
                    byte[] bytes = line.toByteArray();
                    int len = bytes.length;
                    if (len > 0 && bytes[len - 1] == '\r') len--;
                    return new String(bytes, 0, len, StandardCharsets.ISO_8859_1);
                }
                line.write(b);
                prev = b;
                if (line.size() > 16384) throw new IllegalStateException("HTTP line too long");
            }
            return line.size() == 0 ? null
                    : new String(line.toByteArray(), StandardCharsets.ISO_8859_1);
        }

        private String findHeader(Map<String, String> headers, String name) {
            for (Map.Entry<String, String> e : headers.entrySet()) {
                if (name.equalsIgnoreCase(e.getKey())) return e.getValue();
            }
            return "";
        }

        private boolean isHopByHopHeader(String name) {
            return "Host".equalsIgnoreCase(name)
                    || "Connection".equalsIgnoreCase(name)
                    || "Proxy-Connection".equalsIgnoreCase(name)
                    || "Keep-Alive".equalsIgnoreCase(name)
                    || "Transfer-Encoding".equalsIgnoreCase(name)
                    || "TE".equalsIgnoreCase(name)
                    || "Trailer".equalsIgnoreCase(name)
                    || "Upgrade".equalsIgnoreCase(name)
                    || "Accept-Encoding".equalsIgnoreCase(name);
        }

        private void writeStatusLine(OutputStream out, int code) throws Exception {
            String reason;
            switch (code) {
                case 200: reason = "OK"; break;
                case 206: reason = "Partial Content"; break;
                case 204: reason = "No Content"; break;
                case 400: reason = "Bad Request"; break;
                case 403: reason = "Forbidden"; break;
                case 404: reason = "Not Found"; break;
                case 405: reason = "Method Not Allowed"; break;
                case 416: reason = "Range Not Satisfiable"; break;
                default: reason = "Response";
            }
            out.write(("HTTP/1.1 " + code + " " + reason + "\r\n")
                    .getBytes(StandardCharsets.ISO_8859_1));
        }

        private void writeHeader(OutputStream out, String name, String value) throws Exception {
            if (value == null) return;
            out.write((name + ": " + value + "\r\n")
                    .getBytes(StandardCharsets.ISO_8859_1));
        }

        private void writeSimpleResponse(OutputStream out, int code, String text)
                throws Exception {
            byte[] body = text.getBytes(StandardCharsets.UTF_8);
            writeStatusLine(out, code);
            writeHeader(out, "Content-Type", "text/plain; charset=utf-8");
            writeHeader(out, "Content-Length", String.valueOf(body.length));
            writeHeader(out, "Access-Control-Allow-Origin", "*");
            writeHeader(out, "Connection", "close");
            out.write("\r\n".getBytes(StandardCharsets.ISO_8859_1));
            out.write(body);
            out.flush();
        }

        private void writeOptionsResponse(OutputStream out) throws Exception {
            writeStatusLine(out, 204);
            writeHeader(out, "Access-Control-Allow-Origin", "*");
            writeHeader(out, "Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
            writeHeader(out, "Access-Control-Allow-Headers", "Range, Content-Type");
            writeHeader(out, "Access-Control-Max-Age", "86400");
            writeHeader(out, "Connection", "close");
            out.write("\r\n".getBytes(StandardCharsets.ISO_8859_1));
            out.flush();
        }
    }

    private static class AbyssVirtualSource {
        static final long SEGMENT_SIZE = 2L * 1024L * 1024L;

        final String slug;
        final String md5Id;
        final String resId;
        final long totalSize;
        final String domain;
        final String quality;
        final Map<String, String> headers;
        final List<String> hosts;

        AbyssVirtualSource(String slug, String md5Id, String resId,
                           long totalSize, String domain, String quality,
                           Map<String, String> headers, List<String> hosts) {
            this.slug = slug;
            this.md5Id = md5Id;
            this.resId = resId;
            this.totalSize = totalSize;
            this.domain = domain;
            this.quality = quality;
            this.headers = headers == null ? new LinkedHashMap<>()
                    : new LinkedHashMap<>(headers);
            this.hosts = hosts == null ? new ArrayList<>() : new ArrayList<>(hosts);
        }
    }

    private static class RelayTarget {
        final String remoteUrl;
        final Map<String, String> headers;
        final String mime;
        final String referer;
        final AbyssVirtualSource abyss;

        RelayTarget(String remoteUrl, Map<String, String> headers,
                    String mime, String referer) {
            this(remoteUrl, headers, mime, referer, null);
        }

        RelayTarget(String remoteUrl, Map<String, String> headers,
                    String mime, String referer, AbyssVirtualSource abyss) {
            this.remoteUrl = remoteUrl;
            this.headers = headers == null ? new LinkedHashMap<>()
                    : new LinkedHashMap<>(headers);
            this.mime = mime == null ? "video/mp4" : mime;
            this.referer = referer;
            this.abyss = abyss;
        }
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
        pauseLocalForCast = false;
        releaseRelayWakeLock();
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

        int count = getDisplayMedia().size();
        int state = castContext == null ? CastState.NO_DEVICES_AVAILABLE : castContext.getCastState();

        String cast;
        if (state == CastState.CONNECTED) cast = "Cast connected";
        else if (state == CastState.CONNECTING) cast = "Connecting…";
        else if (state == CastState.NOT_CONNECTED) cast = "Cast available";
        else cast = "No Cast device";

        int probing = activeProbes.get();
        int blobs = blobHlsHits.get() + blobVideoHits.get() + mseHits.get();
        statusText.setText(cast + " • " + count + " video" + (count == 1 ? "" : "s")
                + (blobs > 0 ? " • blob " + blobs : "")
                + (probing > 0 ? " • scanning " + probing : "")
                + " • " + blockedAds + " blocked");
        videosButton.setText("Videos (" + count + ")");
    }

    private static class RequestSnapshot {
        final String url;
        final Map<String, String> headers;
        final String source;

        RequestSnapshot(String url, Map<String, String> headers, String source) {
            this.url = url;
            this.headers = headers == null ? new LinkedHashMap<>() : new LinkedHashMap<>(headers);
            this.source = source == null ? "network" : source;
        }
    }

    private static class ProbeResult {
        final String mime;
        final boolean isPlayableRoot;
        final int score;

        ProbeResult(String mime, boolean isPlayableRoot, int score) {
            this.mime = mime == null ? "" : mime;
            this.isPlayableRoot = isPlayableRoot;
            this.score = score;
        }
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
        final long estimatedSizeBytes;

        DetectedMedia(String url, String mime, String source, int score) {
            this.url = url;
            this.mime = mime == null ? "" : mime;
            this.source = source == null ? "unknown" : source;
            this.score = score;
            this.estimatedSizeBytes = parseEstimatedSizeStatic(url);
        }

        private static long parseEstimatedSizeStatic(String rawUrl) {
            if (rawUrl == null) return -1;
            try {
                String path = new URI(rawUrl).getPath();
                if (path == null) return -1;
                Matcher m = Pattern.compile("\\.([0-9]{7,})\\.\\d+\\.fd$",
                        Pattern.CASE_INSENSITIVE).matcher(path);
                if (m.find()) return Long.parseLong(m.group(1));
            } catch (Exception ignored) {
            }
            return -1;
        }

        String displayLabel() {
            String kind;
            String m = mime.toLowerCase(Locale.US);
            if (m.contains("mpegurl")) kind = "HLS";
            else if (m.contains("dash")) kind = "DASH";
            else if (m.contains("webm")) kind = "WEBM";
            else if (m.contains("quicktime")) kind = "MOV";
            else if (source != null && source.contains("range-video")) kind = "DIRECT";
            else if (m.contains("mp4")) kind = "MP4";
            else kind = "STREAM";

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

            String quality = "";
            if (source != null && source.startsWith("abyss-source|")) {
                String[] parts = source.split("\\|");
                String q = parts.length >= 2 ? parts[1] : "Unknown";
                long sz = -1;
                if (parts.length >= 3) {
                    try { sz = Long.parseLong(parts[2]); } catch (Exception ignored) {}
                }
                quality = q + (sz > 0 ? " • " + formatBytesStatic(sz) : "");
                kind = "VIDEO";
            } else if (source != null && source.contains("range-video")) {
                quality = estimatedSizeBytes > 0
                        ? "Current quality • " + formatBytesStatic(estimatedSizeBytes)
                        : "Current quality";
            }
            return kind + (quality.isEmpty() ? "" : " • " + quality)
                    + "\n" + host + " • " + file;
        }

        private static String formatBytesStatic(long bytes) {
            if (bytes <= 0) return "";
            double gb = bytes / (1024.0 * 1024.0 * 1024.0);
            if (gb >= 0.95) return String.format(Locale.US, "%.2f GB", gb);
            double mb = bytes / (1024.0 * 1024.0);
            return String.format(Locale.US, "%.0f MB", mb);
        }
    }
}
