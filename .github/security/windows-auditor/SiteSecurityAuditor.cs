using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("Site Security Auditor")]
[assembly: System.Reflection.AssemblyDescription("Read-only access-control checks for authorized sites")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]

namespace SiteSecurityAuditor
{
    public sealed class Finding
    {
        public string Severity { get; set; }
        public string Check { get; set; }
        public string Endpoint { get; set; }
        public string Evidence { get; set; }
        public string Fix { get; set; }
    }

    public sealed class AuditReport
    {
        public string Version { get; set; }
        public string ScannedAtUtc { get; set; }
        public string TargetOrigin { get; set; }
        public string Mode { get; set; }
        public string Status { get; set; }
        public int SignalScore { get; set; }
        public int PrivatePathsChecked { get; set; }
        public int RequestsSent { get; set; }
        public int High { get; set; }
        public int Medium { get; set; }
        public int Low { get; set; }
        public int Good { get; set; }
        public List<Finding> Findings { get; set; }
        public List<string> Limitations { get; set; }
    }

    public sealed class ScanOptions
    {
        public Uri BaseUri { get; set; }
        public List<string> PrivatePaths { get; set; }
        public bool CanaryLab { get; set; }
        public string ControlProof { get; set; }
        public string CanaryIdA { get; set; }
        public string CanaryTokenA { get; set; }
        public string CanaryMarkerA { get; set; }
        public string CanaryIdB { get; set; }
        public string CanaryTokenB { get; set; }
        public string CanaryMarkerB { get; set; }
        public bool RequireControlProof { get; set; }
    }

    public sealed class SiteScanner : IDisposable
    {
        private const int MaxPrivatePaths = 10;
        private const int MaxRequests = 48;
        private const int MaxCanaryBytes = 65536;
        private readonly HttpClient _client;
        private readonly SemaphoreSlim _requestGate = new SemaphoreSlim(1, 1);
        private int _requestCount;
        private DateTime _lastRequestUtc = DateTime.MinValue;

        public SiteScanner()
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            var handler = new HttpClientHandler
            {
                AllowAutoRedirect = false,
                AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate,
                UseCookies = false,
                UseDefaultCredentials = false,
                PreAuthenticate = false,
                UseProxy = false,
                MaxResponseHeadersLength = 32
            };
            _client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(15) };
            _client.DefaultRequestHeaders.UserAgent.ParseAdd("SiteSecurityAuditor/1.0 (+read-only-authorized-audit)");
        }

        public static Uri ParseTarget(string value)
        {
            if ((value ?? "").Any(Char.IsControl)) throw new ArgumentException("The address contains a control character.");
            Uri uri;
            if (!Uri.TryCreate((value ?? "").Trim(), UriKind.Absolute, out uri))
                throw new ArgumentException("Enter a complete http:// or https:// address.");
            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
                throw new ArgumentException("Only HTTP and HTTPS addresses are supported.");
            if (!String.IsNullOrEmpty(uri.UserInfo) || !String.IsNullOrEmpty(uri.Query) || !String.IsNullOrEmpty(uri.Fragment))
                throw new ArgumentException("The site address cannot contain credentials, a query string, or a fragment.");
            if (String.IsNullOrWhiteSpace(uri.Host)) throw new ArgumentException("The address has no host.");
            if (uri.AbsolutePath != "/" && uri.AbsolutePath != "")
                throw new ArgumentException("Enter the site origin only, without an additional path.");
            return new Uri(uri.GetLeftPart(UriPartial.Authority) + "/");
        }

        public static List<string> ParsePrivatePaths(string value)
        {
            var result = new List<string>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var raw in (value ?? "").Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries))
            {
                var path = raw.Trim();
                if (path.Length == 0) continue;
                if (!path.StartsWith("/", StringComparison.Ordinal) || path.StartsWith("//", StringComparison.Ordinal))
                    throw new ArgumentException("Each private endpoint must be a relative path beginning with one slash.");
                if (path.IndexOf('?') >= 0 || path.IndexOf('#') >= 0)
                    throw new ArgumentException("Private paths cannot contain query strings or fragments.");
                var lowered = path.ToLowerInvariant();
                if (path.IndexOf('\\') >= 0 || lowered.Contains("%0d") || lowered.Contains("%0a") || lowered.Contains("%00") || lowered.Contains("%2f") || lowered.Contains("%5c"))
                    throw new ArgumentException("Private paths cannot contain control characters or encoded path separators.");
                if (path.Length > 300) throw new ArgumentException("A private path is too long.");
                if (seen.Add(path)) result.Add(path);
            }
            if (result.Count > MaxPrivatePaths)
                throw new ArgumentException("Limit private endpoint checks to " + MaxPrivatePaths + " paths per scan.");
            return result;
        }

        public async Task<AuditReport> ScanAsync(ScanOptions options, CancellationToken token)
        {
            if (options == null || options.BaseUri == null) throw new ArgumentException("Missing scan options.");
            if (options.CanaryLab && options.PrivatePaths.Count > 5)
                throw new ArgumentException("Canary Lab is limited to five paths per scan.");
            ValidateCanaryInputs(options);
            var needsControlProof = options.CanaryLab || options.RequireControlProof || options.PrivatePaths.Count > 0;
            if (needsControlProof) ValidateVerifiedTarget(options.BaseUri);
            await EnsureAllowedHostAsync(options.BaseUri).ConfigureAwait(false);
            var findings = new List<Finding>();

            if (needsControlProof)
                await VerifyControlAsync(options, findings, token).ConfigureAwait(false);

            if (options.PrivatePaths.Count == 0)
                Add(findings, "LOW", "Private endpoint coverage", "/", "No expected-private path was supplied.", "Add explicit private paths or use the offline source audit before making a launch decision.");

            var checkedRoot = await CheckRootAsync(options.BaseUri, findings, token).ConfigureAwait(false);
            await CheckCorsAsync(checkedRoot, findings, token).ConfigureAwait(false);

            foreach (var path in options.PrivatePaths)
            {
                token.ThrowIfCancellationRequested();
                var probePath = ExpandPath(path, options.CanaryIdA);
                await CheckPrivatePathAsync(options.BaseUri, path, probePath, findings, token).ConfigureAwait(false);
                if (options.CanaryLab)
                    await CheckLabVariantsAsync(options, path, findings, token).ConfigureAwait(false);
            }

            var report = new AuditReport
            {
                Version = "1",
                ScannedAtUtc = DateTime.UtcNow.ToString("o"),
                TargetOrigin = options.BaseUri.GetLeftPart(UriPartial.Authority),
                Mode = options.CanaryLab ? "verified-canary-lab" : "live-guard",
                Findings = findings,
                Limitations = new List<string>
                {
                    "This is a bounded read-only check, not proof that a site is secure.",
                    "Only the root and explicitly supplied same-origin paths are tested.",
                    "No credential guessing, injection, hidden-path discovery, file retrieval, or destructive request is performed.",
                    "Live Guard does not read response bodies. Canary Lab reads a bounded body only to find supplied synthetic markers, then discards it.",
                    "Cloud IAM, database policy, code paths, rate limits, session lifecycle, and third-party infrastructure need separate review."
                }
            };
            report.High = findings.Count(x => x.Severity == "HIGH");
            report.Medium = findings.Count(x => x.Severity == "MEDIUM");
            report.Low = findings.Count(x => x.Severity == "LOW");
            report.Good = findings.Count(x => x.Severity == "GOOD");
            report.SignalScore = Math.Max(0, 100 - report.High * 20 - report.Medium * 10 - report.Low * 3);
            report.PrivatePathsChecked = options.PrivatePaths.Count;
            report.RequestsSent = _requestCount;
            var exposure = findings.Any(x => x.Severity == "HIGH" && (x.Check == "Unauthenticated access" || x.Check == "Canary account isolation" || x.Check == "Method consistency" || x.Check == "Request variant consistency"));
            var connectionFailure = findings.Any(x => x.Severity == "HIGH" && x.Check == "Connection");
            if (exposure) report.SignalScore = Math.Min(report.SignalScore, 20);
            else if (connectionFailure || findings.Any(x => x.Severity == "HIGH" && x.Check == "Transport")) report.SignalScore = Math.Min(report.SignalScore, 39);
            else if (report.High > 0) report.SignalScore = Math.Min(report.SignalScore, 59);
            report.Status = exposure ? "fail" : connectionFailure ? "inconclusive" : report.High > 0 ? "fail" : report.Medium > 0 ? options.PrivatePaths.Count == 0 ? "review-limited" : "review" : options.PrivatePaths.Count == 0 ? "limited" : "pass-with-limits";
            return report;
        }

        private async Task VerifyControlAsync(ScanOptions options, List<Finding> findings, CancellationToken token)
        {
            if (IsLoopback(options.BaseUri))
            {
                Add(findings, "GOOD", "Control proof", "/", "Explicit loopback target accepted for a disposable local lab.", "Keep the lab isolated and use synthetic records only.");
                return;
            }
            var expected = (options.ControlProof ?? "").Trim();
            if (expected.Length < 24 || expected.Length > 200 || expected.Any(Char.IsControl))
                throw new InvalidOperationException("Verified remote checks require a 24-200 character control proof.");
            var proofUri = SameOriginUri(options.BaseUri, "/.well-known/site-security-auditor.txt");
            using (var response = await SendAsync(HttpMethod.Get, proofUri, null, token).ConfigureAwait(false))
            {
                if (!response.IsSuccessStatusCode)
                    throw new InvalidOperationException("Control proof file was not available (HTTP " + (int)response.StatusCode + ").");
                var proof = await ReadBoundedTextAsync(response, 1024, token).ConfigureAwait(false);
                if (proof.Truncated || !FixedTimeEquals(expected, proof.Text.Trim()))
                    throw new InvalidOperationException("Control proof did not match. Publish the exact token at the documented path.");
            }
            Add(findings, "GOOD", "Control proof", "/.well-known/site-security-auditor.txt", "Remote control proof matched.", "Remove or rotate the proof after the audit window.");
        }

        private async Task<Uri> CheckRootAsync(Uri baseUri, List<Finding> findings, CancellationToken token)
        {
            Uri current = baseUri;
            HttpResponseMessage response = null;
            var transportClassified = baseUri.Scheme == Uri.UriSchemeHttps;
            try
            {
                for (var hop = 0; hop < 4; hop++)
                {
                    if (response != null) response.Dispose();
                    response = await SendAsync(HttpMethod.Get, current, null, token).ConfigureAwait(false);
                    if (!IsRedirect(response.StatusCode))
                    {
                        if (hop == 0 && !transportClassified)
                        {
                            Add(findings, "HIGH", "Transport", "/", "The HTTP origin served a non-redirect response.", "Redirect HTTP directly to the same-host HTTPS origin.");
                            transportClassified = true;
                        }
                        break;
                    }
                    var location = response.Headers.Location;
                    if (location == null)
                    {
                        if (hop == 0 && !transportClassified)
                        {
                            Add(findings, "HIGH", "Transport", "/", "The HTTP origin returned an unusable redirect.", "Redirect HTTP directly to the same-host HTTPS origin.");
                            transportClassified = true;
                        }
                        Add(findings, "MEDIUM", "Redirect", "/", "Redirect response has no Location header.", "Return a complete same-site redirect target.");
                        break;
                    }
                    var next = location.IsAbsoluteUri ? location : new Uri(current, location);
                    if (!AllowedRedirect(current, next) || HasSensitiveUrlParts(next) || IsDowngrade(current, next))
                    {
                        if (hop == 0 && !transportClassified)
                        {
                            Add(findings, "HIGH", "Transport", "/", "The HTTP origin did not provide a clean same-host HTTPS upgrade.", "Redirect HTTP directly to HTTPS without query values or origin changes.");
                            transportClassified = true;
                        }
                        Add(findings, "MEDIUM", "Redirect", "/", "Redirect leaves the allowed origin, downgrades transport, or includes a query value.", "Use a clean same-site HTTPS redirect without credentials or sensitive query values.");
                        break;
                    }
                    if (hop == 0 && !transportClassified)
                    {
                        if (IsCleanHttpUpgrade(current, next))
                            Add(findings, "GOOD", "Transport", "/", "The HTTP origin immediately redirected to same-host HTTPS.", "Keep the direct upgrade redirect in place.");
                        else
                            Add(findings, "MEDIUM", "Transport", "/", "The first HTTP redirect stayed on HTTP before a possible later upgrade.", "Redirect directly to the same-host HTTPS origin.");
                        transportClassified = true;
                    }
                    if (hop == 3)
                    {
                        Add(findings, "MEDIUM", "Redirect", "/", "The redirect chain reached the four-hop limit.", "Use a short direct redirect chain.");
                        break;
                    }
                    current = next;
                }
                if (response == null) return current;
                if (current.Scheme == Uri.UriSchemeHttps)
                    Add(findings, "GOOD", "Transport", "/", "HTTPS certificate validation and the root request succeeded.", "Keep HTTP redirected to HTTPS.");
                Add(findings, response.IsSuccessStatusCode ? "GOOD" : "MEDIUM", "Root response", SafePath(current), "HTTP " + (int)response.StatusCode + ".", "Keep the public entry point intentional and monitor unexpected status changes.");
                CheckHeaders(current, response, findings);
                return current;
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                if (ex is RateLimitException) throw;
                Add(findings, "HIGH", "Connection", "/", "The target could not be checked: " + SafeException(ex), "Verify DNS, TLS, and site availability.");
                return current;
            }
            finally
            {
                if (response != null) response.Dispose();
            }
        }

        private void CheckHeaders(Uri uri, HttpResponseMessage response, List<Finding> findings)
        {
            string value;
            if (uri.Scheme == Uri.UriSchemeHttps)
                CheckHsts(response, findings);
            HeaderFinding(response, findings, "Content-Security-Policy", "MEDIUM", "Content Security Policy", "Define a restrictive CSP and avoid broad script sources.");
            if (!TryHeader(response, "X-Content-Type-Options", out value))
                Add(findings, "LOW", "MIME sniffing", "/", "X-Content-Type-Options is missing.", "Send X-Content-Type-Options: nosniff.");
            else if (String.Equals(value.Trim(), "nosniff", StringComparison.OrdinalIgnoreCase))
                Add(findings, "GOOD", "MIME sniffing", "/", "X-Content-Type-Options has the expected nosniff value.", "Keep the value exact.");
            else
                Add(findings, "LOW", "MIME sniffing", "/", "X-Content-Type-Options is present with an unrecognized value.", "Send X-Content-Type-Options: nosniff.");
            if (!TryHeader(response, "Content-Security-Policy", out value) || value.IndexOf("frame-ancestors", StringComparison.OrdinalIgnoreCase) < 0)
            {
                if (!TryHeader(response, "X-Frame-Options", out value))
                    Add(findings, "LOW", "Frame protection", "/", "No CSP frame-ancestors or X-Frame-Options policy was observed.", "Use CSP frame-ancestors or X-Frame-Options.");
                else if (String.Equals(value.Trim(), "DENY", StringComparison.OrdinalIgnoreCase) || String.Equals(value.Trim(), "SAMEORIGIN", StringComparison.OrdinalIgnoreCase))
                    Add(findings, "GOOD", "Frame protection", "/", "X-Frame-Options has a recognized value.", "Prefer CSP frame-ancestors for a more flexible policy.");
                else
                    Add(findings, "LOW", "Frame protection", "/", "X-Frame-Options is present with an unrecognized value.", "Use DENY, SAMEORIGIN, or CSP frame-ancestors.");
            }
            else Add(findings, "OBSERVED", "Frame protection", "/", "CSP frame-ancestors is present; its policy was not fully evaluated.", "Review the allowed frame origins for the application.");
            HeaderFinding(response, findings, "Referrer-Policy", "LOW", "Referrer policy", "Set a privacy-appropriate Referrer-Policy.");
            HeaderFinding(response, findings, "Permissions-Policy", "LOW", "Browser capabilities", "Set Permissions-Policy for capabilities the site does not need.");

            if (TryHeader(response, "Server", out value) && !String.IsNullOrWhiteSpace(value))
                Add(findings, "LOW", "Server disclosure", SafePath(uri), "A Server header identifies implementation details.", "Remove or minimize server version disclosure where possible.");
            if (TryHeader(response, "X-Powered-By", out value) && !String.IsNullOrWhiteSpace(value))
                Add(findings, "LOW", "Framework disclosure", SafePath(uri), "X-Powered-By is present.", "Remove framework disclosure headers.");

            IEnumerable<string> cookies;
            if (response.Headers.TryGetValues("Set-Cookie", out cookies))
            {
                var cookieNumber = 0;
                foreach (var cookie in cookies.Take(30))
                {
                    cookieNumber++;
                    var missing = new List<string>();
                    if (cookie.IndexOf("; Secure", StringComparison.OrdinalIgnoreCase) < 0) missing.Add("Secure");
                    if (cookie.IndexOf("; HttpOnly", StringComparison.OrdinalIgnoreCase) < 0) missing.Add("HttpOnly");
                    if (cookie.IndexOf("; SameSite=", StringComparison.OrdinalIgnoreCase) < 0) missing.Add("SameSite");
                    if (missing.Count == 0)
                        Add(findings, "GOOD", "Cookie flags", SafePath(uri), "Response cookie #" + cookieNumber + " has Secure, HttpOnly, and SameSite attributes.", "Keep session cookies narrowly scoped.");
                    else
                        Add(findings, "MEDIUM", "Cookie flags", SafePath(uri), "Response cookie #" + cookieNumber + " is missing: " + String.Join(", ", missing) + ".", "Add appropriate Secure, HttpOnly, and SameSite attributes.");
                }
            }
        }

        private static void CheckHsts(HttpResponseMessage response, List<Finding> findings)
        {
            string value;
            if (!TryHeader(response, "Strict-Transport-Security", out value))
            {
                Add(findings, "MEDIUM", "HSTS", "/", "Strict-Transport-Security is missing.", "Add HSTS after confirming all traffic is HTTPS.");
                return;
            }
            long maxAge = -1;
            foreach (var directive in value.Split(';'))
            {
                var part = directive.Trim();
                if (!part.StartsWith("max-age=", StringComparison.OrdinalIgnoreCase)) continue;
                Int64.TryParse(part.Substring(8).Trim(), out maxAge);
            }
            if (maxAge > 0)
                Add(findings, "GOOD", "HSTS", "/", "HSTS has a positive max-age.", "Review duration and subdomain coverage before preload decisions.");
            else
                Add(findings, "MEDIUM", "HSTS", "/", "HSTS is present without a positive max-age.", "Set an intentional positive max-age after validating HTTPS coverage.");
        }

        private static void AddAuditOrigin(HttpRequestMessage request)
        {
            request.Headers.TryAddWithoutValidation("Origin", "https://site-security-auditor.invalid");
        }

        private static void ClassifyCors(HttpResponseMessage response, List<Finding> findings, string endpoint, bool expectedPrivate, int? optionsStatus)
        {
            string origin;
            string credentials;
            string vary;
            var hasOrigin = TryHeader(response, "Access-Control-Allow-Origin", out origin);
            var hasCredentials = TryHeader(response, "Access-Control-Allow-Credentials", out credentials) && String.Equals(credentials.Trim(), "true", StringComparison.OrdinalIgnoreCase);
            var isSuccess = (int)response.StatusCode >= 200 && (int)response.StatusCode < 300;
            var metadata = optionsStatus.HasValue ? " OPTIONS returned HTTP " + optionsStatus.Value + "." : "";
            if (!hasOrigin)
            {
                Add(findings, "GOOD", "CORS", endpoint, "Credential-free GET did not grant the audit origin." + metadata, "Keep server-side authentication; CORS is only a browser read policy.");
                return;
            }
            var trimmed = origin.Trim();
            var reflected = trimmed.IndexOf("site-security-auditor.invalid", StringComparison.OrdinalIgnoreCase) >= 0;
            if (reflected && hasCredentials)
                Add(findings, "HIGH", "CORS", endpoint, "Credential-free GET reflected an arbitrary origin with credential allowance." + metadata, "Validate origins against a strict allowlist and keep server-side authorization.");
            else if (reflected)
                Add(findings, expectedPrivate && isSuccess ? "HIGH" : "MEDIUM", "CORS", endpoint, "Credential-free GET reflected the arbitrary audit origin." + metadata, "Validate origins against a strict allowlist; CORS does not replace authentication.");
            else if (trimmed == "*")
                Add(findings, expectedPrivate && isSuccess ? "HIGH" : hasCredentials ? "MEDIUM" : "LOW", "CORS", endpoint, "Credential-free GET returned wildcard cross-origin access" + (hasCredentials ? " with an incompatible credential flag." : ".") + metadata, "Confirm the resource is public and enforce authorization independently of CORS.");
            else
                Add(findings, "GOOD", "CORS", endpoint, "Credential-free GET did not grant the arbitrary audit origin." + metadata, "Keep the origin allowlist narrow and enforce server-side authorization.");

            if (reflected && (!TryHeader(response, "Vary", out vary) || vary.IndexOf("Origin", StringComparison.OrdinalIgnoreCase) < 0))
                Add(findings, "LOW", "CORS caching", endpoint, "A reflected origin response did not include Vary: Origin.", "Add Vary: Origin to prevent cache confusion.");
        }

        private static void ClassifyPrivateRedirect(Uri baseUri, HttpResponseMessage response, string template, List<Finding> findings)
        {
            var location = response.Headers.Location;
            if (location == null)
            {
                Add(findings, "MEDIUM", "Unauthenticated access", template, "Redirect response had no Location header; no body was read.", "Return a clear 401/403 API denial or an intentional authentication redirect.");
                return;
            }
            var next = location.IsAbsoluteUri ? location : new Uri(baseUri, location);
            if (IsDowngrade(baseUri, next))
                Add(findings, "HIGH", "Unauthenticated access", template, "Expected-private path redirected from HTTPS to a non-HTTPS destination. The destination was not followed.", "Never downgrade authentication or private API traffic.");
            else if (!SameOrigin(baseUri, next))
                Add(findings, "MEDIUM", "Unauthenticated access", template, "Cross-origin authentication or SSO redirect was observed and not followed.", "Verify the API denies access before redirecting and validate the SSO destination separately.");
            else if (LooksLikeLogin(next.AbsolutePath))
                Add(findings, "MEDIUM", "Unauthenticated access", template, "A same-origin authentication-looking redirect was observed; API denial remains unverified.", "Prefer a clear 401/403 for APIs and test the login flow separately.");
            else
                Add(findings, "MEDIUM", "Unauthenticated access", template, "A same-origin redirect was observed; authorization was not established.", "Confirm the final route cannot return private data without authorization.");
        }

        private static bool LooksLikeLogin(string path)
        {
            var value = (path ?? "").ToLowerInvariant();
            return value.Contains("login") || value.Contains("signin") || value.Contains("sign-in") || value.Contains("auth") || value.Contains("session");
        }

        private async Task CheckCorsAsync(Uri baseUri, List<Finding> findings, CancellationToken token)
        {
            try
            {
                int optionsStatus;
                using (var metadata = await SendAsync(HttpMethod.Options, baseUri, null, token, delegate(HttpRequestMessage request)
                {
                    request.Headers.TryAddWithoutValidation("Origin", "https://site-security-auditor.invalid");
                    request.Headers.TryAddWithoutValidation("Access-Control-Request-Method", "GET");
                }).ConfigureAwait(false)) optionsStatus = (int)metadata.StatusCode;
                using (var response = await SendAsync(HttpMethod.Get, baseUri, null, token, AddAuditOrigin).ConfigureAwait(false))
                {
                    ClassifyCors(response, findings, "/", false, optionsStatus);
                }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                if (ex is RateLimitException) throw;
                Add(findings, "LOW", "CORS", "/", "Preflight check could not complete: " + SafeException(ex), "Verify OPTIONS behavior separately.");
            }
        }

        private async Task CheckPrivatePathAsync(Uri baseUri, string template, string path, List<Finding> findings, CancellationToken token)
        {
            var uri = SameOriginUri(baseUri, path);
            try
            {
                int headStatus;
                int getStatus;
                using (var head = await SendAsync(HttpMethod.Head, uri, null, token).ConfigureAwait(false))
                    headStatus = (int)head.StatusCode;
                using (var response = await SendAsync(HttpMethod.Get, uri, null, token).ConfigureAwait(false))
                {
                    var status = (int)response.StatusCode;
                    getStatus = status;
                    if ((headStatus == 401 || headStatus == 403) && status >= 200 && status < 300)
                        Add(findings, "HIGH", "Method consistency", template, "HEAD was denied but GET returned HTTP " + status + ". No body was read.", "Apply the same server-side authorization policy to every supported method.");
                    else if (headStatus >= 200 && headStatus < 300 && (status == 401 || status == 403))
                        Add(findings, "LOW", "Method consistency", template, "HEAD returned success while GET was denied.", "Confirm HEAD cannot reveal sensitive metadata and shares the intended authorization policy.");
                    if (status == 401 || status == 403)
                        Add(findings, "GOOD", "Unauthenticated access", template, "Request was denied with HTTP " + status + ". No body was read.", "Keep authorization checks before data access.");
                    else if (status == 404)
                        Add(findings, "LOW", "Unauthenticated access", template, "Path returned 404, so its authorization was not verified.", "Confirm the endpoint path and test it with synthetic records before launch.");
                    else if (status == 204)
                        Add(findings, "MEDIUM", "Unauthenticated access", template, "Expected-private path returned HTTP 204; denial was not established and no body was read.", "Use a consistent 401 or 403 for unauthenticated private requests.");
                    else if (status >= 200 && status < 300)
                        Add(findings, "HIGH", "Unauthenticated access", template, "Expected-private path returned HTTP " + status + " without credentials. No body was read.", "Require authentication and object-level authorization before producing a response.");
                    else if (IsRedirect(response.StatusCode))
                        ClassifyPrivateRedirect(uri, response, template, findings);
                    else
                        Add(findings, "MEDIUM", "Unauthenticated access", template, "Unexpected HTTP " + status + "; denial was not clearly established.", "Return a consistent 401 or 403 before private data access.");

                    string cache;
                    if (!TryHeader(response, "Cache-Control", out cache) || cache.IndexOf("no-store", StringComparison.OrdinalIgnoreCase) < 0)
                        Add(findings, "LOW", "Private response caching", template, "No explicit no-store directive was observed.", "Apply Cache-Control: no-store to private and authentication responses where appropriate.");
                }
                using (var corsResponse = await SendAsync(HttpMethod.Get, uri, null, token, AddAuditOrigin).ConfigureAwait(false))
                {
                    var corsStatus = (int)corsResponse.StatusCode;
                    if (corsStatus >= 200 && corsStatus < 300 && corsStatus != 204)
                        Add(findings, "HIGH", "Request variant consistency", template, "An Origin-bearing credential-free GET returned HTTP " + corsStatus + " for an expected-private path. No body was read.", "Do not use Origin as authentication; apply identical authorization before every response.");
                    else if (!(getStatus >= 200 && getStatus < 300) && corsStatus == 204)
                        Add(findings, "MEDIUM", "Request variant consistency", template, "Adding an untrusted Origin header changed a denial or error into HTTP 204.", "Apply identical authorization before every response variant.");
                    ClassifyCors(corsResponse, findings, template, true, null);
                }
            }
            catch (Exception ex)
            {
                if (ex is OperationCanceledException) throw;
                if (ex is RateLimitException) throw;
                Add(findings, "MEDIUM", "Unauthenticated access", template, "Check failed: " + SafeException(ex), "Verify the endpoint and retry.");
            }
        }

        private async Task CheckLabVariantsAsync(ScanOptions options, string template, List<Finding> findings, CancellationToken token)
        {
            var samplePath = ExpandPath(template, options.CanaryIdA);
            using (var invalid = await SendAsync(HttpMethod.Get, SameOriginUri(options.BaseUri, samplePath), "site-auditor-invalid-canary", token).ConfigureAwait(false))
            {
                var status = (int)invalid.StatusCode;
                Add(findings, status == 401 || status == 403 ? "GOOD" : (status >= 200 && status < 300 ? "HIGH" : "MEDIUM"),
                    "Invalid credential", template, "Synthetic invalid bearer token returned HTTP " + status + ". No body was read.",
                    "Reject malformed, expired, and unknown credentials before data access.");
            }

            if (template.IndexOf("{id}", StringComparison.OrdinalIgnoreCase) < 0) return;
            if (!CompleteCanaryPair(options))
            {
                Add(findings, "LOW", "Canary account isolation", template, "The {id} template was not tested because both synthetic accounts were not configured.", "Provide two disposable accounts, their tokens, IDs, and unique marker strings.");
                return;
            }

            await CheckCanaryRequest(options, template, "A own record", options.CanaryIdA, options.CanaryTokenA, options.CanaryMarkerA, true, findings, token).ConfigureAwait(false);
            await CheckCanaryRequest(options, template, "A to B record", options.CanaryIdB, options.CanaryTokenA, options.CanaryMarkerB, false, findings, token).ConfigureAwait(false);
            await CheckCanaryRequest(options, template, "B own record", options.CanaryIdB, options.CanaryTokenB, options.CanaryMarkerB, true, findings, token).ConfigureAwait(false);
            await CheckCanaryRequest(options, template, "B to A record", options.CanaryIdA, options.CanaryTokenB, options.CanaryMarkerA, false, findings, token).ConfigureAwait(false);
        }

        private async Task CheckCanaryRequest(ScanOptions options, string template, string label, string id, string bearer, string marker, bool own, List<Finding> findings, CancellationToken token)
        {
            var uri = SameOriginUri(options.BaseUri, ExpandPath(template, id));
            using (var response = await SendAsync(HttpMethod.Get, uri, bearer, token).ConfigureAwait(false))
            {
                var bounded = await ReadBoundedTextAsync(response, MaxCanaryBytes, token).ConfigureAwait(false);
                var markerSeen = bounded.Text.IndexOf(marker, StringComparison.Ordinal) >= 0;
                var status = (int)response.StatusCode;
                if (own)
                {
                    if (response.IsSuccessStatusCode && markerSeen)
                        Add(findings, "GOOD", "Canary account isolation", template, label + " baseline returned its expected synthetic marker.", "Keep this as an authorized-flow regression test.");
                    else
                        Add(findings, "LOW", "Canary account isolation", template, label + " baseline was inconclusive (HTTP " + status + ", marker " + (markerSeen ? "seen" : "not seen") + (bounded.Truncated ? ", bounded response truncated" : "") + ").", "Check the disposable account setup and marker placement.");
                }
                else
                {
                    if (markerSeen || response.IsSuccessStatusCode)
                        Add(findings, "HIGH", "Canary account isolation", template, label + " was not clearly denied (HTTP " + status + ", foreign marker " + (markerSeen ? "seen" : "not seen") + ").", "Enforce object ownership from the authenticated principal on every request.");
                    else if ((status == 401 || status == 403 || status == 404) && !bounded.Truncated)
                        Add(findings, "GOOD", "Canary account isolation", template, label + " was denied and the foreign marker was absent.", "Keep cross-account tests in CI using disposable fixtures.");
                    else if (bounded.Truncated)
                        Add(findings, "MEDIUM", "Canary account isolation", template, label + " returned a truncated bounded response; foreign-marker absence is inconclusive.", "Return a small, consistent denial body before any record serialization.");
                    else
                        Add(findings, "MEDIUM", "Canary account isolation", template, label + " returned HTTP " + status + " without the foreign marker.", "Use a consistent denial status and verify server-side authorization logs.");
                }
            }
        }

        private async Task<HttpResponseMessage> SendAsync(HttpMethod method, Uri uri, string bearer, CancellationToken token, Action<HttpRequestMessage> configure = null)
        {
            await EnsureAllowedHostAsync(uri).ConfigureAwait(false);
            await _requestGate.WaitAsync(token).ConfigureAwait(false);
            try
            {
                if (_requestCount >= MaxRequests) throw new InvalidOperationException("The 48-request scan limit was reached.");
                var wait = TimeSpan.FromMilliseconds(750) - (DateTime.UtcNow - _lastRequestUtc);
                if (wait > TimeSpan.Zero) await Task.Delay(wait, token).ConfigureAwait(false);
                _requestCount++;
                _lastRequestUtc = DateTime.UtcNow;
                var request = new HttpRequestMessage(method, uri);
                request.Headers.CacheControl = new CacheControlHeaderValue { NoCache = true, NoStore = true };
                request.Headers.Accept.ParseAdd("application/json, text/html;q=0.5, */*;q=0.1");
                if (!String.IsNullOrEmpty(bearer)) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
                if (configure != null) configure(request);
                try
                {
                    var response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token).ConfigureAwait(false);
                    if ((int)response.StatusCode == 429)
                    {
                        response.Dispose();
                        throw new RateLimitException();
                    }
                    return response;
                }
                finally { request.Dispose(); }
            }
            finally { _requestGate.Release(); }
        }

        private static async Task<BoundedReadResult> ReadBoundedTextAsync(HttpResponseMessage response, int limit, CancellationToken token)
        {
            using (var stream = await response.Content.ReadAsStreamAsync().ConfigureAwait(false))
            using (var memory = new MemoryStream())
            {
                var buffer = new byte[4096];
                while (memory.Length < limit)
                {
                    token.ThrowIfCancellationRequested();
                    var remaining = (int)Math.Min(buffer.Length, limit - memory.Length);
                    var read = await stream.ReadAsync(buffer, 0, remaining, token).ConfigureAwait(false);
                    if (read <= 0) break;
                    memory.Write(buffer, 0, read);
                }
                var truncated = response.Content.Headers.ContentLength.HasValue && response.Content.Headers.ContentLength.Value > limit;
                if (!truncated && memory.Length == limit)
                {
                    var extra = new byte[1];
                    truncated = await stream.ReadAsync(extra, 0, 1, token).ConfigureAwait(false) > 0;
                }
                return new BoundedReadResult { Text = Encoding.UTF8.GetString(memory.ToArray()), Truncated = truncated };
            }
        }

        private sealed class BoundedReadResult
        {
            public string Text { get; set; }
            public bool Truncated { get; set; }
        }

        private static void HeaderFinding(HttpResponseMessage response, List<Finding> findings, string header, string severity, string check, string fix)
        {
            string value;
            if (TryHeader(response, header, out value) && !String.IsNullOrWhiteSpace(value))
                Add(findings, "OBSERVED", check, "/", header + " is present; its full policy was not evaluated.", "Review the policy value as the application changes.");
            else Add(findings, severity, check, "/", header + " is missing.", fix);
        }

        private static bool TryHeader(HttpResponseMessage response, string name, out string value)
        {
            IEnumerable<string> values;
            if (response.Headers.TryGetValues(name, out values) || response.Content.Headers.TryGetValues(name, out values))
            {
                value = String.Join(", ", values.Take(20).Select(x => SafeHeaderValue(x)));
                return true;
            }
            value = "";
            return false;
        }

        private static string SafeHeaderValue(string value)
        {
            var clean = (value ?? "").Replace("\r", " ").Replace("\n", " ");
            return clean.Length > 500 ? clean.Substring(0, 500) : clean;
        }

        private static Uri SameOriginUri(Uri baseUri, string path)
        {
            Uri result;
            if (!Uri.TryCreate(baseUri, path, out result) || !SameOrigin(baseUri, result))
                throw new InvalidOperationException("A path left the configured origin.");
            return result;
        }

        private static bool SameOrigin(Uri left, Uri right)
        {
            return String.Equals(left.Scheme, right.Scheme, StringComparison.OrdinalIgnoreCase)
                && String.Equals(left.Host, right.Host, StringComparison.OrdinalIgnoreCase)
                && left.Port == right.Port;
        }

        private static bool AllowedRedirect(Uri current, Uri next)
        {
            if (!String.Equals(current.Host, next.Host, StringComparison.OrdinalIgnoreCase)) return false;
            if (current.Scheme == next.Scheme && current.Port == next.Port) return true;
            return current.Scheme == Uri.UriSchemeHttp && current.IsDefaultPort
                && next.Scheme == Uri.UriSchemeHttps && next.IsDefaultPort;
        }

        internal static bool IsCleanHttpUpgrade(Uri current, Uri next)
        {
            return current != null && next != null && current.Scheme == Uri.UriSchemeHttp && current.IsDefaultPort
                && next.Scheme == Uri.UriSchemeHttps && next.IsDefaultPort
                && String.Equals(current.Host, next.Host, StringComparison.OrdinalIgnoreCase)
                && !HasSensitiveUrlParts(next);
        }

        private static bool IsLoopback(Uri uri)
        {
            if (String.Equals(uri.DnsSafeHost, "localhost", StringComparison.OrdinalIgnoreCase)) return true;
            IPAddress address;
            return IPAddress.TryParse(uri.DnsSafeHost, out address) && IPAddress.IsLoopback(NormalizeAddress(address));
        }

        private static bool HasSensitiveUrlParts(Uri uri)
        {
            return !String.IsNullOrEmpty(uri.UserInfo) || !String.IsNullOrEmpty(uri.Query) || !String.IsNullOrEmpty(uri.Fragment);
        }

        private static bool IsDowngrade(Uri current, Uri next)
        {
            return current.Scheme == Uri.UriSchemeHttps && next.Scheme != Uri.UriSchemeHttps;
        }

        private static bool IsRedirect(HttpStatusCode code)
        {
            var status = (int)code;
            return status == 301 || status == 302 || status == 303 || status == 307 || status == 308;
        }

        private static string SafePath(Uri uri)
        {
            return String.IsNullOrEmpty(uri.AbsolutePath) ? "/" : uri.AbsolutePath;
        }

        private static string ExpandPath(string template, string id)
        {
            if (template.IndexOf("{id}", StringComparison.OrdinalIgnoreCase) < 0) return template;
            if (String.IsNullOrWhiteSpace(id)) throw new InvalidOperationException("A {id} path requires Canary ID A in Lab mode.");
            var escaped = Uri.EscapeDataString(id.Trim());
            return ReplaceInvariant(template, "{id}", escaped);
        }

        private static string ReplaceInvariant(string value, string oldValue, string newValue)
        {
            var start = value.IndexOf(oldValue, StringComparison.OrdinalIgnoreCase);
            while (start >= 0)
            {
                value = value.Substring(0, start) + newValue + value.Substring(start + oldValue.Length);
                start = value.IndexOf(oldValue, start + newValue.Length, StringComparison.OrdinalIgnoreCase);
            }
            return value;
        }

        private static bool CompleteCanaryPair(ScanOptions options)
        {
            return !String.IsNullOrWhiteSpace(options.CanaryIdA)
                && !String.IsNullOrWhiteSpace(options.CanaryTokenA)
                && !String.IsNullOrWhiteSpace(options.CanaryMarkerA)
                && !String.IsNullOrWhiteSpace(options.CanaryIdB)
                && !String.IsNullOrWhiteSpace(options.CanaryTokenB)
                && !String.IsNullOrWhiteSpace(options.CanaryMarkerB);
        }

        private static bool FixedTimeEquals(string expected, string actual)
        {
            var a = Encoding.UTF8.GetBytes(expected ?? "");
            var b = Encoding.UTF8.GetBytes(actual ?? "");
            var length = Math.Max(a.Length, b.Length);
            var difference = a.Length ^ b.Length;
            for (var i = 0; i < length; i++)
            {
                var av = i < a.Length ? a[i] : 0;
                var bv = i < b.Length ? b[i] : 0;
                difference |= av ^ bv;
            }
            return difference == 0;
        }

        private static void ValidateCanaryInputs(ScanOptions options)
        {
            if (!options.CanaryLab) return;
            var anyPairValue = new[] { options.CanaryIdA, options.CanaryTokenA, options.CanaryMarkerA, options.CanaryIdB, options.CanaryTokenB, options.CanaryMarkerB }
                .Any(x => !String.IsNullOrWhiteSpace(x));
            if (!anyPairValue) return;
            if (!CompleteCanaryPair(options))
                throw new ArgumentException("Canary account testing requires both IDs, tokens, and markers.");
            if (options.CanaryTokenA.Length > 4096 || options.CanaryTokenB.Length > 4096)
                throw new ArgumentException("A canary token is too long.");
            if (!SafeCanaryId(options.CanaryIdA) || !SafeCanaryId(options.CanaryIdB))
                throw new ArgumentException("Canary IDs may contain only 1-80 letters, numbers, dots, underscores, or hyphens.");
            if (options.CanaryTokenA.Any(Char.IsWhiteSpace) || options.CanaryTokenB.Any(Char.IsWhiteSpace) || options.CanaryTokenA.Any(Char.IsControl) || options.CanaryTokenB.Any(Char.IsControl))
                throw new ArgumentException("Canary bearer tokens cannot contain whitespace or control characters.");
            if (options.CanaryMarkerA.Length < 16 || options.CanaryMarkerB.Length < 16 || options.CanaryMarkerA.Length > 200 || options.CanaryMarkerB.Length > 200)
                throw new ArgumentException("Each canary marker must be 16-200 characters.");
            if (options.CanaryMarkerA.Any(Char.IsControl) || options.CanaryMarkerB.Any(Char.IsControl))
                throw new ArgumentException("Canary markers cannot contain control characters.");
            if (String.Equals(options.CanaryMarkerA, options.CanaryMarkerB, StringComparison.Ordinal))
                throw new ArgumentException("Canary markers must be different.");
        }

        public static void ValidateVerifiedTarget(Uri uri)
        {
            if (uri == null) throw new ArgumentException("Missing Canary Lab target.");
            if (!IsLoopback(uri) && uri.Scheme != Uri.UriSchemeHttps)
                throw new InvalidOperationException("Remote verified checks must use HTTPS before private paths or test credentials are sent.");
        }

        private static bool SafeCanaryId(string value)
        {
            if (String.IsNullOrWhiteSpace(value) || value.Length > 80) return false;
            return value.All(c => Char.IsLetterOrDigit(c) || c == '.' || c == '_' || c == '-');
        }

        private static async Task EnsureAllowedHostAsync(Uri uri)
        {
            if (IsMetadataHost(uri.Host)) throw new InvalidOperationException("Cloud metadata targets are blocked.");
            var explicitLoopback = IsLoopback(uri);
            IPAddress[] addresses;
            try { addresses = await Dns.GetHostAddressesAsync(uri.DnsSafeHost).ConfigureAwait(false); }
            catch { throw new InvalidOperationException("The target host could not be resolved."); }
            if (addresses.Length == 0) throw new InvalidOperationException("The target host resolved to no addresses.");
            foreach (var address in addresses)
            {
                var normalized = NormalizeAddress(address);
                if (IsMetadataAddress(normalized)) throw new InvalidOperationException("Cloud metadata targets are blocked.");
                if (IsPrivateAddress(normalized) && !(explicitLoopback && IPAddress.IsLoopback(normalized)))
                    throw new InvalidOperationException("Private and link-local network targets are blocked. Use localhost for a local lab.");
            }
        }

        private static bool IsMetadataHost(string host)
        {
            return String.Equals(host, "metadata.google.internal", StringComparison.OrdinalIgnoreCase)
                || String.Equals(host, "metadata.azure.internal", StringComparison.OrdinalIgnoreCase);
        }

        internal static bool IsMetadataAddress(IPAddress address)
        {
            address = NormalizeAddress(address);
            return address.ToString() == "169.254.169.254" || address.ToString() == "100.100.100.200"
                || String.Equals(address.ToString(), "fd00:ec2::254", StringComparison.OrdinalIgnoreCase);
        }

        internal static bool IsPrivateAddress(IPAddress address)
        {
            address = NormalizeAddress(address);
            if (address.AddressFamily == AddressFamily.InterNetwork)
            {
                var b = address.GetAddressBytes();
                return b[0] == 10 || b[0] == 127 || b[0] == 0 || b[0] == 169 && b[1] == 254
                    || b[0] == 172 && b[1] >= 16 && b[1] <= 31 || b[0] == 192 && b[1] == 168
                    || b[0] == 100 && b[1] >= 64 && b[1] <= 127 || b[0] >= 224
                    || b[0] == 198 && (b[1] == 18 || b[1] == 19);
            }
            if (address.AddressFamily == AddressFamily.InterNetworkV6)
            {
                var b = address.GetAddressBytes();
                return address.Equals(IPAddress.IPv6Any) || address.Equals(IPAddress.IPv6None)
                    || address.IsIPv6LinkLocal || address.IsIPv6SiteLocal || (b[0] & 0xFE) == 0xFC
                    || b[0] == 0xFF || IPAddress.IsLoopback(address);
            }
            return true;
        }

        private static IPAddress NormalizeAddress(IPAddress address)
        {
            return address.AddressFamily == AddressFamily.InterNetworkV6 && address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;
        }

        private static string SafeException(Exception ex)
        {
            if (ex is TaskCanceledException) return "request timed out";
            if (ex is HttpRequestException) return "network or TLS error";
            return ex.GetType().Name;
        }

        private static void Add(List<Finding> findings, string severity, string check, string endpoint, string evidence, string fix)
        {
            findings.Add(new Finding { Severity = severity, Check = check, Endpoint = endpoint, Evidence = evidence, Fix = fix });
        }

        private sealed class RateLimitException : Exception
        {
            public RateLimitException() : base("The server returned HTTP 429. The scan stopped to respect rate limits.") { }
        }

        public void Dispose() { _client.Dispose(); _requestGate.Dispose(); }
    }

    public static class ReportRedactor
    {
        public static AuditReport CreateExportCopy(AuditReport source)
        {
            if (source == null) throw new ArgumentNullException("source");
            var endpointMap = new Dictionary<string, string>(StringComparer.Ordinal);
            var nextEndpoint = 1;
            Func<string, string> redactEndpoint = delegate(string endpoint)
            {
                if (String.IsNullOrEmpty(endpoint) || endpoint == "/") return "/";
                if (endpoint == "/.well-known/site-security-auditor.txt") return endpoint;
                string redacted;
                if (!endpointMap.TryGetValue(endpoint, out redacted))
                {
                    redacted = "/configured-endpoint-" + nextEndpoint.ToString("00");
                    endpointMap[endpoint] = redacted;
                    nextEndpoint++;
                }
                return redacted;
            };
            return new AuditReport
            {
                Version = source.Version,
                ScannedAtUtc = source.ScannedAtUtc,
                TargetOrigin = source.TargetOrigin,
                Mode = source.Mode,
                Status = source.Status,
                SignalScore = source.SignalScore,
                PrivatePathsChecked = source.PrivatePathsChecked,
                RequestsSent = source.RequestsSent,
                High = source.High,
                Medium = source.Medium,
                Low = source.Low,
                Good = source.Good,
                Findings = source.Findings.Select(x => new Finding
                {
                    Severity = x.Severity,
                    Check = x.Check,
                    Endpoint = redactEndpoint(x.Endpoint),
                    Evidence = x.Evidence,
                    Fix = x.Fix
                }).ToList(),
                Limitations = new List<string>(source.Limitations)
            };
        }
    }

#if TEST
    internal static class Program
    {
        [STAThread]
        private static int Main(string[] args)
        {
            try
            {
                Assert(SiteScanner.ParseTarget("https://example.test/").ToString() == "https://example.test/", "target normalization");
                RejectTarget("https://example.test/path");
                RejectTarget("file:///c:/temp/test");
                RejectTarget("https://user:pass@example.test/");
                RejectTarget("https://example.test/?token=fixture");
                RejectTarget("https://example.test/\r\nX-Test: fixture");
                var paths = SiteScanner.ParsePrivatePaths("/api/private\n/api/items/{id}\n/api/private");
                Assert(paths.Count == 2, "path de-duplication");
                RejectPaths("https://different.test/private");
                RejectPaths("//different.test/private");
                RejectPaths("/api/private?token=fixture");
                RejectPaths("/api/%2f/private");
                RejectRemoteHttpLab();
                Assert(SiteScanner.IsMetadataAddress(IPAddress.Parse("::ffff:169.254.169.254")), "mapped metadata address block");
                Assert(SiteScanner.IsPrivateAddress(IPAddress.Parse("::ffff:192.168.1.10")), "mapped private address block");
                Assert(SiteScanner.IsPrivateAddress(IPAddress.IPv6Any), "IPv6 unspecified address block");
                Assert(SiteScanner.IsPrivateAddress(IPAddress.Parse("ff02::1")), "IPv6 multicast block");
                Assert(SiteScanner.IsCleanHttpUpgrade(new Uri("http://example.test/"), new Uri("https://example.test/")), "clean HTTP upgrade");
                Assert(!SiteScanner.IsCleanHttpUpgrade(new Uri("http://example.test/"), new Uri("https://other.test/")), "cross-host upgrade rejected");
                RunIntegrationTests().GetAwaiter().GetResult();
                Console.WriteLine("Site Security Auditor self-tests passed.");
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Self-test failed: " + ex.Message);
                return 1;
            }
        }

        private static void RejectTarget(string value)
        {
            try { SiteScanner.ParseTarget(value); throw new Exception("unsafe target accepted"); }
            catch (ArgumentException) { }
        }

        private static void RejectPaths(string value)
        {
            try { SiteScanner.ParsePrivatePaths(value); throw new Exception("unsafe path accepted"); }
            catch (ArgumentException) { }
        }

        private static void RejectRemoteHttpLab()
        {
            try { SiteScanner.ValidateVerifiedTarget(new Uri("http://203.0.113.1/")); throw new Exception("remote HTTP lab accepted"); }
            catch (InvalidOperationException) { }
        }

        private static void Assert(bool condition, string name)
        {
            if (!condition) throw new Exception(name);
        }

        private static async Task RunIntegrationTests()
        {
            using (var server = new MiniServer())
            {
                using (var scanner = new SiteScanner())
                {
                    var live = await scanner.ScanAsync(new ScanOptions
                    {
                        BaseUri = server.BaseUri,
                        PrivatePaths = new List<string> { "/api/private" }
                    }, CancellationToken.None);
                    Assert(live.Findings.Any(x => x.Check == "Unauthenticated access" && x.Severity == "GOOD"), "live denial result");
                    var liveJson = new JavaScriptSerializer().Serialize(ReportRedactor.CreateExportCopy(live));
                    Assert(liveJson.IndexOf("fixture-private-body-secret", StringComparison.Ordinal) < 0, "private body redaction");
                    Assert(liveJson.IndexOf("fixture-cookie-secret", StringComparison.Ordinal) < 0, "cookie value redaction");
                    Assert(liveJson.IndexOf("fixture-reason-secret", StringComparison.Ordinal) < 0, "reason phrase redaction");
                }

                const string tokenA = "fixture-token-a-value";
                const string tokenB = "fixture-token-b-value";
                const string markerA = "fixture-marker-a-0001";
                const string markerB = "fixture-marker-b-0002";
                AuditReport lab;
                using (var scanner = new SiteScanner())
                {
                    lab = await scanner.ScanAsync(new ScanOptions
                    {
                        BaseUri = server.BaseUri,
                        CanaryLab = true,
                        ControlProof = "fixture-control-proof-000000000000",
                        PrivatePaths = new List<string> { "/api/users/{id}" },
                        CanaryIdA = "a",
                        CanaryTokenA = tokenA,
                        CanaryMarkerA = markerA,
                        CanaryIdB = "b",
                        CanaryTokenB = tokenB,
                        CanaryMarkerB = markerB
                    }, CancellationToken.None);
                }
                Assert(lab.Findings.Count(x => x.Check == "Canary account isolation" && x.Severity == "GOOD") == 2, "canary own-record results");
                Assert(lab.Findings.Count(x => x.Check == "Canary account isolation" && x.Severity == "MEDIUM") == 2, "truncated cross-account results");
                Assert(!lab.Findings.Any(x => x.Check == "Canary account isolation" && x.Severity == "HIGH"), "canary false exposure");
                var json = new JavaScriptSerializer().Serialize(ReportRedactor.CreateExportCopy(lab));
                Assert(json.IndexOf(tokenA, StringComparison.Ordinal) < 0 && json.IndexOf(tokenB, StringComparison.Ordinal) < 0, "token redaction");
                Assert(json.IndexOf(markerA, StringComparison.Ordinal) < 0 && json.IndexOf(markerB, StringComparison.Ordinal) < 0, "marker redaction");
                Assert(json.IndexOf("fixture-control-proof", StringComparison.Ordinal) < 0, "control proof redaction");

                using (var scanner = new SiteScanner())
                {
                    var exposure = await scanner.ScanAsync(new ScanOptions
                    {
                        BaseUri = server.BaseUri,
                        ControlProof = "fixture-control-proof-000000000000",
                        PrivatePaths = new List<string> { "/api/exposed/sensitive-account-123", "/api/redirect", "/api/origin-unlock" }
                    }, CancellationToken.None);
                    Assert(exposure.Status == "fail" && exposure.SignalScore <= 20, "exposure score cap");
                    Assert(exposure.Findings.Any(x => x.Check == "CORS" && x.Endpoint.Contains("exposed") && x.Severity == "HIGH"), "actual private CORS GET");
                    Assert(exposure.Findings.Any(x => x.Check == "Unauthenticated access" && x.Endpoint == "/api/redirect" && x.Severity == "MEDIUM"), "redirect classification");
                    Assert(!exposure.Findings.Any(x => x.Check == "Unauthenticated access" && x.Endpoint == "/api/redirect" && x.Severity == "GOOD"), "redirect not treated as authorization");
                    Assert(exposure.Findings.Any(x => x.Check == "Request variant consistency" && x.Endpoint == "/api/origin-unlock" && x.Severity == "HIGH"), "Origin cannot unlock endpoint");
                    var exposureJson = new JavaScriptSerializer().Serialize(ReportRedactor.CreateExportCopy(exposure));
                    Assert(exposureJson.IndexOf("sensitive-account-123", StringComparison.Ordinal) < 0, "endpoint path redaction");
                    Assert(exposureJson.IndexOf("fixture-redirect-secret", StringComparison.Ordinal) < 0, "redirect value redaction");
                    Assert(exposureJson.IndexOf("fixture-origin-body-secret", StringComparison.Ordinal) < 0, "Origin response body redaction");
                }

                var rateStopped = false;
                try
                {
                    using (var scanner = new SiteScanner())
                        await scanner.ScanAsync(new ScanOptions { BaseUri = server.BaseUri, PrivatePaths = new List<string> { "/api/rate" } }, CancellationToken.None);
                }
                catch (Exception ex) { rateStopped = ex.Message.IndexOf("429", StringComparison.Ordinal) >= 0; }
                Assert(rateStopped, "HTTP 429 stops scan");
                Assert(!server.CookieSeen, "response cookie was not replayed");
            }
        }

        private sealed class MiniServer : IDisposable
        {
            private readonly TcpListener _listener;
            private readonly CancellationTokenSource _stop = new CancellationTokenSource();
            private readonly Task _loop;
            public Uri BaseUri { get; private set; }
            public bool CookieSeen { get; private set; }

            public MiniServer()
            {
                _listener = new TcpListener(IPAddress.Loopback, 0);
                _listener.Start();
                var port = ((IPEndPoint)_listener.LocalEndpoint).Port;
                BaseUri = new Uri("http://127.0.0.1:" + port + "/");
                _loop = Task.Run((Func<Task>)AcceptLoopAsync);
            }

            private async Task AcceptLoopAsync()
            {
                while (!_stop.IsCancellationRequested)
                {
                    TcpClient client;
                    try { client = await _listener.AcceptTcpClientAsync(); }
                    catch { if (_stop.IsCancellationRequested) return; throw; }
                    try { await HandleAsync(client); } catch { }
                }
            }

            private async Task HandleAsync(TcpClient client)
            {
                using (client)
                using (var stream = client.GetStream())
                {
                    var data = new List<byte>();
                    var buffer = new byte[1024];
                    while (data.Count < 8192)
                    {
                        var read = await stream.ReadAsync(buffer, 0, buffer.Length);
                        if (read <= 0) break;
                        data.AddRange(buffer.Take(read));
                        var received = Encoding.ASCII.GetString(data.ToArray());
                        if (received.IndexOf("\r\n\r\n", StringComparison.Ordinal) >= 0) break;
                    }
                    var request = Encoding.ASCII.GetString(data.ToArray());
                    var lines = request.Split(new[] { "\r\n" }, StringSplitOptions.None);
                    var requestParts = lines[0].Split(' ');
                    var method = requestParts.Length > 0 ? requestParts[0] : "";
                    var path = requestParts.Length > 1 ? requestParts[1] : "/";
                    var authLine = lines.FirstOrDefault(x => x.StartsWith("Authorization:", StringComparison.OrdinalIgnoreCase)) ?? "";
                    var auth = authLine.Length > 14 ? authLine.Substring(14).Trim() : "";
                    CookieSeen = CookieSeen || lines.Any(x => x.StartsWith("Cookie:", StringComparison.OrdinalIgnoreCase));
                    var hasAuditOrigin = lines.Any(x => String.Equals(x.Trim(), "Origin: https://site-security-auditor.invalid", StringComparison.OrdinalIgnoreCase));

                    var status = 404;
                    var body = "";
                    if (method == "OPTIONS" && path == "/") status = 204;
                    else if (method == "GET" && path == "/") status = 200;
                    else if (path == "/api/private") { status = 401; body = "fixture-private-body-secret"; }
                    else if (path == "/api/users/a")
                    {
                        if (auth == "Bearer fixture-token-a-value") { status = 200; body = "fixture-marker-a-0001"; }
                        else if (auth == "Bearer fixture-token-b-value") { status = 403; body = new String('x', 66000) + "fixture-marker-a-0001"; }
                        else status = 401;
                    }
                    else if (path == "/api/users/b")
                    {
                        if (auth == "Bearer fixture-token-b-value") { status = 200; body = "fixture-marker-b-0002"; }
                        else if (auth == "Bearer fixture-token-a-value") { status = 403; body = new String('x', 66000) + "fixture-marker-b-0002"; }
                        else status = 401;
                    }
                    else if (path == "/api/exposed/sensitive-account-123") { status = 200; body = "fixture-exposed-body-secret"; }
                    else if (path == "/api/redirect") status = 302;
                    else if (path == "/api/origin-unlock") { status = hasAuditOrigin ? 200 : 403; body = "fixture-origin-body-secret"; }
                    else if (path == "/api/rate") status = 429;

                    var reason = status == 200 ? "fixture-reason-secret" : status == 204 ? "No Content" : status == 401 ? "Unauthorized" : status == 403 ? "Forbidden" : "Not Found";
                    reason = status == 302 ? "Found" : status == 429 ? "Too Many Requests" : reason;
                    if (method == "HEAD") body = "";
                    var bodyBytes = Encoding.UTF8.GetBytes(body);
                    var headers = "HTTP/1.1 " + status + " " + reason + "\r\n"
                        + "Connection: close\r\nCache-Control: no-store\r\nContent-Type: text/plain; charset=utf-8\r\n"
                        + (path == "/" ? "Set-Cookie: session=fixture-cookie-secret; Secure; HttpOnly; SameSite=Strict\r\n" : "")
                        + (path == "/api/redirect" ? "Location: /login?token=fixture-redirect-secret\r\n" : "")
                        + (path == "/api/exposed/sensitive-account-123" && hasAuditOrigin ? "Access-Control-Allow-Origin: https://site-security-auditor.invalid\r\nAccess-Control-Allow-Credentials: true\r\n" : "")
                        + "Content-Security-Policy: default-src 'none'\r\nX-Content-Type-Options: nosniff\r\n"
                        + "X-Frame-Options: DENY\r\nReferrer-Policy: no-referrer\r\nPermissions-Policy: camera=()\r\n"
                        + "Content-Length: " + bodyBytes.Length + "\r\n\r\n";
                    var headerBytes = Encoding.ASCII.GetBytes(headers);
                    await stream.WriteAsync(headerBytes, 0, headerBytes.Length);
                    if (bodyBytes.Length > 0) await stream.WriteAsync(bodyBytes, 0, bodyBytes.Length);
                }
            }

            public void Dispose()
            {
                _stop.Cancel();
                _listener.Stop();
                try { _loop.Wait(1000); } catch { }
                _stop.Dispose();
            }
        }
    }
#else
    public sealed class MainForm : Form
    {
        private readonly TextBox _url = new TextBox();
        private readonly TextBox _paths = new TextBox();
        private readonly CheckBox _authorized = new CheckBox();
        private readonly ComboBox _mode = new ComboBox();
        private readonly TextBox _proof = SecretBox();
        private readonly TextBox _idA = new TextBox();
        private readonly TextBox _tokenA = SecretBox();
        private readonly TextBox _markerA = SecretBox();
        private readonly TextBox _idB = new TextBox();
        private readonly TextBox _tokenB = SecretBox();
        private readonly TextBox _markerB = SecretBox();
        private readonly Panel _labPanel = new Panel();
        private readonly Button _scan = new Button();
        private readonly Button _monitor = new Button();
        private readonly Button _cancel = new Button();
        private readonly Button _export = new Button();
        private readonly NumericUpDown _interval = new NumericUpDown();
        private readonly DataGridView _grid = new DataGridView();
        private readonly Label _summary = new Label();
        private readonly Label _status = new Label();
        private readonly System.Windows.Forms.Timer _timer = new System.Windows.Forms.Timer();
        private CancellationTokenSource _scanCancellation;
        private AuditReport _lastReport;
        private bool _isScanning;
        private bool _monitoring;

        public MainForm()
        {
            Text = "Site Security Auditor";
            MinimumSize = new Size(980, 720);
            Size = new Size(1260, 820);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(18, 24, 35);
            ForeColor = Color.FromArgb(232, 238, 247);
            Font = new Font("Segoe UI", 9.5f);
            BuildUi();
        }

        private void BuildUi()
        {
            var root = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(16), ColumnCount = 1, RowCount = 7, BackColor = BackColor };
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 70));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 115));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 150));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 48));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 34));
            Controls.Add(root);

            var title = new Label { Dock = DockStyle.Fill, Text = "SITE SECURITY AUDITOR\r\nRead-only live checks and verified synthetic-account testing", Font = new Font("Segoe UI Semibold", 15f), ForeColor = Color.White };
            root.Controls.Add(title, 0, 0);

            var target = TwoColumnPanel("Site address", _url, "Example: https://staging.example.com");
            _url.Text = "https://";
            root.Controls.Add(target, 0, 1);

            _paths.Multiline = true;
            _paths.ScrollBars = ScrollBars.Vertical;
            _paths.Font = new Font("Consolas", 9.5f);
            _paths.Text = "";
            var pathsBox = new GroupBox { Dock = DockStyle.Fill, Text = "Expected-private paths (one per line; use {id} only with disposable canary accounts)", ForeColor = ForeColor, Padding = new Padding(10) };
            pathsBox.Controls.Add(_paths);
            _paths.Dock = DockStyle.Fill;
            StyleInput(_paths);
            root.Controls.Add(pathsBox, 0, 2);

            BuildLabPanel();
            root.Controls.Add(_labPanel, 0, 3);

            var controls = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.LeftToRight, WrapContents = false, Padding = new Padding(0, 6, 0, 0) };
            _authorized.Text = "I own or am authorized to test this site";
            _authorized.AutoSize = true;
            _authorized.Margin = new Padding(0, 8, 16, 0);
            controls.Controls.Add(_authorized);
            _mode.DropDownStyle = ComboBoxStyle.DropDownList;
            _mode.Items.AddRange(new object[] { "Live Guard", "Verified Canary Lab" });
            _mode.SelectedIndex = 0;
            _mode.Width = 180;
            _mode.SelectedIndexChanged += delegate { UpdateMode(); };
            StyleInput(_mode);
            controls.Controls.Add(_mode);
            _scan.Text = "Scan now";
            _scan.Click += async delegate { await StartScanAsync(false); };
            controls.Controls.Add(_scan);
            _monitor.Text = "Start monitor";
            _monitor.Click += async delegate { await ToggleMonitorAsync(); };
            controls.Controls.Add(_monitor);
            _cancel.Text = "Cancel";
            _cancel.Enabled = false;
            _cancel.Click += delegate { if (_scanCancellation != null) _scanCancellation.Cancel(); };
            controls.Controls.Add(_cancel);
            _export.Text = "Export redacted JSON";
            _export.Enabled = false;
            _export.Click += delegate { ExportReport(); };
            controls.Controls.Add(_export);
            controls.Controls.Add(new Label { Text = "Every", AutoSize = true, Margin = new Padding(16, 9, 4, 0) });
            _interval.Minimum = 60;
            _interval.Maximum = 3600;
            _interval.Value = 60;
            _interval.Width = 70;
            controls.Controls.Add(_interval);
            controls.Controls.Add(new Label { Text = "seconds", AutoSize = true, Margin = new Padding(4, 9, 0, 0) });
            foreach (Control control in controls.Controls) if (control is Button) StyleButton((Button)control);
            root.Controls.Add(controls, 0, 4);

            ConfigureGrid();
            root.Controls.Add(_grid, 0, 5);

            var footer = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2 };
            footer.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 70));
            footer.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 30));
            _status.Text = "Ready. Response bodies are never displayed or exported.";
            _status.Dock = DockStyle.Fill;
            _summary.TextAlign = ContentAlignment.MiddleRight;
            _summary.Dock = DockStyle.Fill;
            footer.Controls.Add(_status, 0, 0);
            footer.Controls.Add(_summary, 1, 0);
            root.Controls.Add(footer, 0, 6);

            _timer.Tick += async delegate
            {
                if (_monitoring && !_isScanning)
                {
                    var completed = await StartScanAsync(true);
                    if (!completed) StopMonitor("Monitor stopped after an incomplete check.");
                }
            };
            UpdateMode();
        }

        private void BuildLabPanel()
        {
            _labPanel.Dock = DockStyle.Fill;
            _labPanel.BackColor = Color.FromArgb(25, 33, 47);
            var table = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(10), ColumnCount = 8, RowCount = 3 };
            for (var i = 0; i < 8; i++) table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 12.5f));
            table.RowStyles.Add(new RowStyle(SizeType.Absolute, 36));
            table.RowStyles.Add(new RowStyle(SizeType.Absolute, 42));
            table.RowStyles.Add(new RowStyle(SizeType.Absolute, 42));
            _labPanel.Controls.Add(table);

            var labTitle = new Label { Text = "Remote private-path, monitor, and Canary checks require this proof at /.well-known/site-security-auditor.txt", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft };
            table.Controls.Add(labTitle, 0, 0);
            table.SetColumnSpan(labTitle, 6);
            var generate = new Button { Text = "Generate proof", Dock = DockStyle.Fill };
            StyleButton(generate);
            generate.Click += delegate { _proof.Text = GenerateProof(); };
            table.Controls.Add(generate, 6, 0);
            table.SetColumnSpan(generate, 2);

            AddField(table, "Control proof", _proof, 0, 1, 2);
            AddField(table, "Canary A ID", _idA, 2, 1, 2);
            AddField(table, "Token A", _tokenA, 4, 1, 2);
            AddField(table, "Marker A", _markerA, 6, 1, 2);
            AddField(table, "Canary B ID", _idB, 0, 2, 2);
            AddField(table, "Token B", _tokenB, 2, 2, 2);
            AddField(table, "Marker B", _markerB, 4, 2, 2);
            var note = new Label { Text = "Tokens and markers stay in memory and are omitted from reports.", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft, ForeColor = Color.FromArgb(166, 182, 204) };
            table.Controls.Add(note, 6, 2);
            table.SetColumnSpan(note, 2);
        }

        private static void AddField(TableLayoutPanel table, string label, Control input, int column, int row, int span)
        {
            var panel = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2, Margin = new Padding(4, 0, 4, 0) };
            panel.RowStyles.Add(new RowStyle(SizeType.Absolute, 17));
            panel.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            panel.Controls.Add(new Label { Text = label, Dock = DockStyle.Fill, Font = new Font("Segoe UI", 8f) }, 0, 0);
            input.Dock = DockStyle.Fill;
            StyleInput(input);
            panel.Controls.Add(input, 0, 1);
            table.Controls.Add(panel, column, row);
            table.SetColumnSpan(panel, span);
        }

        private Control TwoColumnPanel(string label, Control input, string hint)
        {
            var panel = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 1, Padding = new Padding(0, 12, 0, 8) };
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 110));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 70));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 30));
            panel.Controls.Add(new Label { Text = label, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft }, 0, 0);
            input.Dock = DockStyle.Fill;
            StyleInput(input);
            panel.Controls.Add(input, 1, 0);
            panel.Controls.Add(new Label { Text = hint, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft, ForeColor = Color.FromArgb(166, 182, 204), Padding = new Padding(10, 0, 0, 0) }, 2, 0);
            return panel;
        }

        private void ConfigureGrid()
        {
            _grid.Dock = DockStyle.Fill;
            _grid.AllowUserToAddRows = false;
            _grid.AllowUserToDeleteRows = false;
            _grid.AllowUserToResizeRows = true;
            _grid.ReadOnly = true;
            _grid.AutoGenerateColumns = false;
            _grid.BackgroundColor = Color.FromArgb(14, 19, 28);
            _grid.BorderStyle = BorderStyle.None;
            _grid.RowHeadersVisible = false;
            _grid.AutoSizeRowsMode = DataGridViewAutoSizeRowsMode.AllCells;
            _grid.DefaultCellStyle.BackColor = Color.FromArgb(22, 29, 41);
            _grid.DefaultCellStyle.ForeColor = ForeColor;
            _grid.DefaultCellStyle.SelectionBackColor = Color.FromArgb(42, 65, 94);
            _grid.DefaultCellStyle.WrapMode = DataGridViewTriState.True;
            _grid.ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(35, 46, 63);
            _grid.ColumnHeadersDefaultCellStyle.ForeColor = Color.White;
            _grid.EnableHeadersVisualStyles = false;
            _grid.Columns.Add(Column("Severity", "Severity", 76));
            _grid.Columns.Add(Column("Check", "Check", 160));
            _grid.Columns.Add(Column("Endpoint", "Endpoint", 190));
            _grid.Columns.Add(FillColumn("Evidence", "Evidence", 45));
            _grid.Columns.Add(FillColumn("Fix", "Recommended fix", 55));
            _grid.CellFormatting += delegate(object sender, DataGridViewCellFormattingEventArgs e)
            {
                if (e.RowIndex < 0 || e.ColumnIndex != 0 || e.Value == null) return;
                var value = e.Value.ToString();
                if (value == "HIGH") e.CellStyle.ForeColor = Color.FromArgb(255, 108, 108);
                else if (value == "MEDIUM") e.CellStyle.ForeColor = Color.FromArgb(255, 186, 89);
                else if (value == "LOW") e.CellStyle.ForeColor = Color.FromArgb(250, 222, 102);
                else if (value == "GOOD") e.CellStyle.ForeColor = Color.FromArgb(108, 226, 160);
            };
        }

        private async Task<bool> StartScanAsync(bool monitorRun)
        {
            if (_isScanning) return false;
            if (!_authorized.Checked)
            {
                MessageBox.Show(this, "Confirm that you own or are authorized to test the target.", "Authorization required", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return false;
            }
            ScanOptions options;
            try { options = ReadOptions(monitorRun); }
            catch (Exception ex)
            {
                MessageBox.Show(this, ex.Message, "Check configuration", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return false;
            }

            var completed = false;
            _isScanning = true;
            _scan.Enabled = false;
            _cancel.Enabled = true;
            _status.Text = "Scanning bounded same-origin checks...";
            _scanCancellation = new CancellationTokenSource();
            _scanCancellation.CancelAfter(TimeSpan.FromMinutes(3));
            try
            {
                using (var scanner = new SiteScanner())
                    _lastReport = await scanner.ScanAsync(options, _scanCancellation.Token);
                RenderReport(_lastReport);
                _status.Text = "Completed at " + DateTime.Now.ToLongTimeString() + ". Review findings before launch.";
                _export.Enabled = true;
                completed = true;
            }
            catch (OperationCanceledException) { _status.Text = "Scan cancelled."; }
            catch (Exception ex)
            {
                _status.Text = "Scan did not complete.";
                MessageBox.Show(this, ex.Message, "Audit incomplete", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            finally
            {
                if (_scanCancellation != null) _scanCancellation.Dispose();
                _scanCancellation = null;
                _isScanning = false;
                _scan.Enabled = true;
                _cancel.Enabled = false;
            }
            return completed;
        }

        private async Task ToggleMonitorAsync()
        {
            if (_monitoring)
            {
                StopMonitor("Monitor stopped.");
                return;
            }
            _monitoring = true;
            _timer.Interval = (int)_interval.Value * 1000;
            _timer.Start();
            _monitor.Text = "Stop monitor";
            var completed = await StartScanAsync(true);
            if (!completed)
                StopMonitor("Monitor stopped after an incomplete check.");
        }

        private void StopMonitor(string status)
        {
            _monitoring = false;
            _timer.Stop();
            _monitor.Text = "Start monitor";
            _status.Text = status;
        }

        private ScanOptions ReadOptions(bool requireControlProof)
        {
            return new ScanOptions
            {
                BaseUri = SiteScanner.ParseTarget(_url.Text),
                PrivatePaths = SiteScanner.ParsePrivatePaths(_paths.Text),
                CanaryLab = _mode.SelectedIndex == 1,
                ControlProof = _proof.Text,
                CanaryIdA = _idA.Text,
                CanaryTokenA = _tokenA.Text,
                CanaryMarkerA = _markerA.Text,
                CanaryIdB = _idB.Text,
                CanaryTokenB = _tokenB.Text,
                CanaryMarkerB = _markerB.Text,
                RequireControlProof = requireControlProof
            };
        }

        private void RenderReport(AuditReport report)
        {
            _grid.DataSource = null;
            _grid.DataSource = report.Findings;
            _summary.Text = report.Status.ToUpperInvariant() + "  |  Signal score " + report.SignalScore + "/100  |  High " + report.High + "  Medium " + report.Medium + "  Low " + report.Low;
        }

        private void ExportReport()
        {
            if (_lastReport == null) return;
            using (var dialog = new SaveFileDialog { Filter = "JSON report (*.json)|*.json", FileName = "site-security-audit-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".json", InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments) })
            {
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                var serializer = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 };
                File.WriteAllText(dialog.FileName, serializer.Serialize(ReportRedactor.CreateExportCopy(_lastReport)), new UTF8Encoding(false));
                _status.Text = "Redacted report exported. Tokens, markers, cookies, and response bodies were excluded.";
            }
        }

        private void UpdateMode()
        {
            var lab = _mode.SelectedIndex == 1;
            _labPanel.Enabled = true;
            _idA.Enabled = lab;
            _tokenA.Enabled = lab;
            _markerA.Enabled = lab;
            _idB.Enabled = lab;
            _tokenB.Enabled = lab;
            _markerB.Enabled = lab;
            _labPanel.BackColor = lab ? Color.FromArgb(25, 33, 47) : Color.FromArgb(20, 26, 37);
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            _timer.Stop();
            if (_scanCancellation != null) _scanCancellation.Cancel();
            _proof.Clear(); _tokenA.Clear(); _markerA.Clear(); _tokenB.Clear(); _markerB.Clear();
            base.OnFormClosing(e);
        }

        private static TextBox SecretBox() { return new TextBox { UseSystemPasswordChar = true }; }

        private static string GenerateProof()
        {
            var bytes = new byte[32];
            using (var random = RandomNumberGenerator.Create()) random.GetBytes(bytes);
            return BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
        }

        private static DataGridViewTextBoxColumn Column(string property, string title, int width)
        {
            return new DataGridViewTextBoxColumn { DataPropertyName = property, HeaderText = title, Width = width, SortMode = DataGridViewColumnSortMode.Automatic };
        }

        private static DataGridViewTextBoxColumn FillColumn(string property, string title, float weight)
        {
            return new DataGridViewTextBoxColumn { DataPropertyName = property, HeaderText = title, AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill, FillWeight = weight, SortMode = DataGridViewColumnSortMode.Automatic };
        }

        private static void StyleInput(Control input)
        {
            input.BackColor = Color.FromArgb(240, 244, 249);
            input.ForeColor = Color.FromArgb(20, 28, 39);
        }

        private static void StyleButton(Button button)
        {
            button.AutoSize = true;
            button.FlatStyle = FlatStyle.Flat;
            button.BackColor = Color.FromArgb(50, 104, 178);
            button.ForeColor = Color.White;
            button.FlatAppearance.BorderColor = Color.FromArgb(80, 135, 205);
            button.Margin = new Padding(5, 0, 5, 0);
            button.Padding = new Padding(8, 3, 8, 3);
        }
    }

    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
#endif
}
