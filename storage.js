/* Nura local data layer.
   Keeping storage access in one place makes a future move to a cloud database easier. */
(function () {
  const PREFIX = "nura2_";
  window.NuraStorage = {
    get(key, fallback) {
      try {
        const saved = localStorage.getItem(PREFIX + key);
        return saved === null ? fallback : JSON.parse(saved);
      } catch (error) {
        console.warn("Nura could not read saved data:", error);
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.warn("Nura could not save data:", error);
        return false;
      }
    }
  };
})();
