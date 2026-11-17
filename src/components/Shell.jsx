import usePageStyles from "../hooks/usePageStyles";
import useTitle from "../hooks/useTitle";
import testsCss from "../styles/tests.css?inline";
import quizCss from "../styles/quiz.css?inline";

const css = testsCss + "\n" + quizCss;

// Каркас страницы в дизайне сайта: заголовок, содержимое и подвал
export default function Shell({ title, heading, footer, children }) {
  usePageStyles(css);
  useTitle(title);
  return (
    <>
      <main className="main">
        <div className="contaniner">
          <div className="text_t">
            <h4>{heading || title}</h4>
          </div>
          <div className="text profile">{children}</div>
        </div>
      </main>
      <footer className="footer">
        <div className="contaniner">
          <div className="taxt_footer">
            <p>{footer || "Результаты тестов не являются диагнозом. При тревожном состоянии обратитесь к специалисту."}</p>
          </div>
        </div>
      </footer>
    </>
  );
}
