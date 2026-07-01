const BASE_PATH = "/ActivatedGeneratedScheduler/";

const stripSlashes = (value) => String(value || "").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");

const decodeRoute = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const routeKey = () => {
  const base = stripSlashes(BASE_PATH);
  const path = stripSlashes(window.location.pathname);
  const hash = stripSlashes(window.location.hash.replace(/^#\/?/, ""));
  const pathRoute = base && path.startsWith(`${base}/`) ? path.slice(base.length + 1) : path === base ? "" : path;
  const route = stripSlashes(decodeRoute(pathRoute || hash));
  const lowerRoute = route.toLowerCase();

  if (lowerRoute.startsWith("professor/")) return `professor:${route.slice(10)}`;
  if (lowerRoute.startsWith("room/")) return `room:${route.slice(5)}`;
  return "main";
};

let currentRouteKey = routeKey();
let refreshScheduled = false;

const refreshOnRouteChange = () => {
  const nextRouteKey = routeKey();
  if (nextRouteKey === currentRouteKey || refreshScheduled) return;
  currentRouteKey = nextRouteKey;
  refreshScheduled = true;
  window.setTimeout(() => window.location.reload(), 0);
};

const wrapHistoryMethod = (methodName) => {
  const original = window.history[methodName];
  if (typeof original !== "function") return;
  window.history[methodName] = function wrappedHistoryMethod(...args) {
    const result = original.apply(this, args);
    window.dispatchEvent(new Event("ags-routechange"));
    return result;
  };
};

wrapHistoryMethod("pushState");
wrapHistoryMethod("replaceState");

window.addEventListener("hashchange", refreshOnRouteChange);
window.addEventListener("popstate", refreshOnRouteChange);
window.addEventListener("ags-routechange", refreshOnRouteChange);
