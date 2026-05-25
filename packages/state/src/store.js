const STORAGE_KEY = 'nycss-settings';

export function createStore(initial, options = {}) {
  const {
    key = STORAGE_KEY,
    persist = true,
    onSet = {},
    onInit = {}
  } = options;

  const saved = persist ? JSON.parse(localStorage.getItem(key) || '{}') : {};
  const state = { ...initial, ...saved };

  const store = new Proxy(state, {
    set(target, prop, value) {
      const old = target[prop];
      if (old === value) {
        return true;
      }
      target[prop] = value;
      if (persist) {
        const snapshot = {};
        for (const k in target) snapshot[k] = target[k];
        localStorage.setItem(key, JSON.stringify(snapshot));
      }
      if (onSet[prop]) {
        onSet[prop](value, old, target);
      }
      return true;
    },
    get(target, prop) {
      if (prop === '_subscribe') {
        return (keyOrMap, fn) => {
          if (typeof keyOrMap === 'string') {
            onSet[keyOrMap] = fn;
          } else {
            Object.assign(onSet, keyOrMap);
          }
        };
      }
      if (prop === '_init') {
        return (keyOrMap) => {
          let map;
          if (typeof keyOrMap === 'string') {
            map = { [keyOrMap]: true };
          } else if (Array.isArray(keyOrMap)) {
            map = {};
            for (const k of keyOrMap) {
              if (typeof k === 'string') map[k] = true;
            }
          } else {
            map = keyOrMap;
          }
          Object.assign(onInit, map);
          for (const k in onInit) {
            if (onSet[k]) {
              onSet[k](target[k], undefined, target);
            }
          }
        };
      }
      if (prop === '_snapshot') {
        return () => {
          const snap = {};
          for (const k in target) snap[k] = target[k];
          return snap;
        };
      }
      if (prop === '_reset') {
        return () => {
          for (const k in initial) {
            store[k] = initial[k];
          }
          localStorage.removeItem(key);
        };
      }
      return target[prop];
    }
  });

  return store;
}
