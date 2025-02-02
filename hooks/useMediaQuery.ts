import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);

    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listner = () => setMatches(media.matches);
    media.addListener(listner);

    return () => media.removeListener(listner);
  }, [matches, query]);

  return matches;
}
