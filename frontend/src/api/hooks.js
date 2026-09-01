import { useEffect, useState, useRef } from "react";

export function useApiResource(loader, deps = [], pollInterval = 0) {
  const [resource, setResource] = useState({ state: "loading", data: null, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let active = true;

    // Preserve previous data during refetch to prevent UI flickering & unmounting
    setResource((prev) => ({
      state: prev.data ? "success" : "loading",
      data: prev.data,
      error: null,
    }));

    let timer = null;

    const executeLoader = () => {
      loaderRef.current()
        .then((data) => {
          if (active) {
            setResource({ state: "success", data, error: null });
          }
        })
        .catch((error) => {
          if (active) {
            setResource((prev) => ({
              state: prev.data ? "success" : "error",
              data: prev.data,
              error: prev.data ? null : error,
            }));
          }
        })
        .finally(() => {
          if (active && pollInterval > 0) {
            timer = setTimeout(executeLoader, pollInterval);
          }
        });
    };

    executeLoader();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [...deps, pollInterval]);

  return resource;
}
