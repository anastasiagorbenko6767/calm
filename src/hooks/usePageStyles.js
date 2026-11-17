import { useLayoutEffect } from "react";

// У каждой страницы исходного сайта свой CSS-файл, и они конфликтуют между собой
// (разные размеры h2, p, фоны и т.д.). Чтобы внешний вид остался точно прежним,
// подключаем CSS страницы при её показе и убираем при уходе с неё.
// Когда будете делать новый дизайн, эти файлы можно слить в один обычный index.css
// и этот хук убрать.
export default function usePageStyles(css) {
  useLayoutEffect(() => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    return () => style.remove();
  }, [css]);
}
