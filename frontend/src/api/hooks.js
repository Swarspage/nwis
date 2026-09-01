import { useEffect, useState } from "react";

export function useApiResource(loader, deps = []) {
  const [resource, setResource] = useState({ state: "loading", data: null, error: null });

  useEffect(() => {
    let active = true;
    setResource({ state: "loading", data: null, error: null });

    loader()
      .then((data) => {
        if (active) setResource({ state: "success", data, error: null });
      })
      .catch((error) => {
        if (active) setResource({ state: "error", data: null, error });
      });

    return () => {
      active = false;
    };
  }, deps);

  return resource;
}
