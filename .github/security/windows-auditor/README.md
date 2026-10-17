# Site Security Auditor for Windows

`SiteSecurityAuditor.exe` is a bounded, read-only checker for sites you own or
are authorized to test. It is designed for rapid patch-and-recheck work without
retrieving or displaying backend records.

## Modes

**Live Guard** checks the root with credential-free `GET` and `OPTIONS`. For up
to 10 same-origin paths you enter, it compares `HEAD` and `GET`, then makes one
credential-free `GET` carrying an audit `Origin` header. It checks HTTPS,
redirects, security headers,
cookie flags, CORS behavior, caching, and whether an expected-private endpoint
returns success without credentials. It never reads response bodies.

Remote private-path checks and monitor mode require the target to serve the
control-proof token below. An unverified remote scan is limited to the public
root posture checks.

**Verified Canary Lab** is for a disposable local or staging environment with
synthetic data. Remote staging sites must prove control by serving an exact
random token over HTTPS at:

```text
/.well-known/site-security-auditor.txt
```

For an endpoint such as `/api/users/{id}`, enter two disposable account IDs,
their short-lived bearer tokens, and a unique fake marker stored in each test
record. The app checks each account's own record and attempts the two cross-
account combinations. It records only whether a marker was seen, immediately
discards the bounded response, and excludes tokens and markers from exported
reports. Never use production customer accounts or production secrets here.
Canary Lab accepts at most five paths per scan. Remote HTTP targets are rejected
before a canary credential is sent.

The lab also submits a fixed invalid bearer token. It does not guess passwords
or tokens, discover hidden routes, inject payloads, exploit a finding, retrieve
files, send mutation methods, or make cross-origin requests.

## Build and run

On Windows PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .github\security\windows-auditor\build.ps1
```

Then launch the executable built outside the Netlify publish tree:

```text
%LOCALAPPDATA%\SiteSecurityAuditor\SiteSecurityAuditor.exe
```

The build uses the Windows .NET Framework compiler and requires no NuGet or npm
packages. `build.ps1` compiles and runs a separate self-test executable before
reporting the app's SHA-256 hash. It rejects custom output directories inside
the repository so executables cannot enter the Netlify publish tree.

The local executable is unsigned. Sign release builds with your organization’s
code-signing certificate before distributing them to other machines.

The scanner makes one request at a time, waits at least 750 ms between requests,
stops on HTTP 429, and caps each run at 48 requests. It blocks private/link-local
network targets other than localhost and always blocks cloud metadata addresses.
It follows only clean same-host redirects and never downgrades HTTPS.
Resolved-address checks run before each request but cannot pin DNS with the
installed .NET Framework HTTP stack; use a trusted staging hostname and keep
the target isolated from internal and metadata networks.

## How to use it while patching

1. Put only explicitly private endpoints in the path list.
2. Run Live Guard and treat any unauthenticated 2xx response as a review item.
3. Reproduce object-level authorization only in Canary Lab with two disposable
   records and unique fake markers.
4. Patch authorization in server code, restart or redeploy staging, and click
   **Scan now** again. Monitor mode can repeat the same bounded checks every
   60 seconds or more.
5. Export the redacted JSON report for review. The signal score is a compact
   count of findings, not a security certification. Likely exposure caps the
   score at 20 and sets an explicit failure status. Concrete endpoint paths,
   response bodies, cookie values, tokens, and canary markers are omitted or
   replaced in exported reports.

The tool cannot prove a site is secure. Review server code, deployment IAM,
database policies, session handling, audit logs, rate limits, and dependencies
separately. Pair the app with a private source review before launch.

CORS is a browser response-reading policy, not authentication. A CORS finding
does not mean the backend is protected or exposed by itself; server-side
authentication and object-level authorization remain required.
