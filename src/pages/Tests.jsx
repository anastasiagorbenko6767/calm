import { Fragment } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGlobe } from "@fortawesome/free-solid-svg-icons";
import usePageStyles from "../hooks/usePageStyles";
import useTitle from "../hooks/useTitle";
import css from "../styles/tests.css?inline";
import quizzes from "../data/quizzes";

export default function Tests() {
  usePageStyles(css);
  useTitle("тесты");

  return (
    <>
      <main className="main">
        <div className="contaniner">
          <div className="text_t">
            <h4>Психологические тесты</h4>
          </div>
          <div className="text">
            <p>Научно обоснованные опросники, которые можно пройти бесплатно прямо на этом сайте.</p>
            <p>Тесты на психологическое состояние помогают заподозрить у себя какие-либо проблемы или расстройства, а также вместе со специалистом регулярно проверять их динамику.</p>
            {quizzes.map((q) => (
              <Fragment key={q.slug}>
                <h2>{q.title}</h2>
                <p>{q.intro}</p>
                <div className="test">
                  <p>{q.card.essence}</p>
                  <p>{q.card.result}</p>
                  <p>{q.card.duration}</p>
                  <Link className="test_web" to={`/tests/${q.slug}`}>
                    пройти на сайте
                  </Link>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </main>
      <footer className="footer">
        <div className="contaniner">
          <div className="taxt_footer">
            <p>Все опросники находятся в открытом доступе. Авторов и источник можно посмотреть внизу страницы каждого теста. Результаты сохраняются в вашем профиле.</p>
            <Link className="web" to="/profile"> <FontAwesomeIcon icon={faGlobe} /> Профиль</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
