import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// При переходе на другую страницу прокручиваем наверх, как в обычном сайте
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
