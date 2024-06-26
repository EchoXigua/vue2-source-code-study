export let warn;

if (process.env.NODE_ENV !== "production") {
  const hasConsole = typeof console !== "undefined";

  warn = (msg, vm) => {
    if (hasConsole) {
      console.error(
        // `[Vue xigua warn]: ${msg}` + (vm ? generateComponentTrace(vm) : "")
        `[Vue xigua warn]: ${msg}`
      );
    }
  };
}
