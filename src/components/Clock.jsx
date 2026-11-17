import { useEffect, useState } from "react";

// Электронные часы с главной страницы
export default function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return <div id="clock">{now.toLocaleTimeString()}</div>;
}
