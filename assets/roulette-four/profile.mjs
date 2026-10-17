const GENDERS = new Set(["male", "female", "enby"]);
export function normalizeProfile(value) {
  if (
    !value ||
    !/^\d+$/.test(String(value.id)) ||
    typeof value.name !== "string" ||
    !value.name.trim()
  )
    return null;
  let avatar = null;
  try {
    const url = new URL(value.avatar);
    if (url.protocol === "https:" && !url.username && !url.password)
      avatar = url.href;
  } catch {}
  return {
    id: String(value.id),
    name: value.name.trim().slice(0, 40),
    gender: GENDERS.has(value.gender) ? value.gender : "unknown",
    avatar,
  };
}
export async function loadProfile() {
  let key, id;
  try {
    key = localStorage.getItem("tornVisitorApiKey");
    id = localStorage.getItem("tornKeyConfirmedUserId");
  } catch {}
  if (!key)
    return {
      status: "guest",
      message:
        "Connect your Torn API key in the lobby to use your name and profile picture automatically.",
    };
  const cacheKey = "rouletteFourProfileV1";
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey)),
      profile = normalizeProfile(cached?.profile),
      age = Date.now() - cached?.at;
    if (
      id &&
      profile?.id === id &&
      Number.isFinite(age) &&
      age >= 0 &&
      age < 600000
    )
      return { status: "connected", profile };
  } catch {}
  try {
    const response = await fetch("/.netlify/functions/roulette-four-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorKey: key }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json(),
      profile = normalizeProfile(data.profile);
    if (!response.ok || !data.ok || !profile)
      return {
        status: "unavailable",
        message:
          data.error || "Profile unavailable. Guest play is still available.",
      };
    try {
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify({ at: Date.now(), profile }),
      );
    } catch {}
    return { status: "connected", profile };
  } catch {
    return {
      status: "unavailable",
      message: "Profile unavailable. Guest play is still available.",
    };
  }
}
