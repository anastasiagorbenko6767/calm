import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGlobe } from "@fortawesome/free-solid-svg-icons";
import usePageStyles from "../hooks/usePageStyles";
import useTitle from "../hooks/useTitle";
import testsCss from "../styles/tests.css?inline";
import quizCss from "../styles/quiz.css?inline";
import quizzes from "../data/quizzes";
import { computeResult } from "../lib/scoring";
import { fetchResults, saveResult } from "../api";
import { useAuth } from "../auth";

// Тот же дизайн, что у страницы «тесты», плюс стили самого опросника
const css = testsCss + "\n" + quizCss;

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

// step: -1 - вступление, 0..n-1 - вопросы, n - результат
export default function Quiz() {
  const { slug } = useParams();
  const { user } = useAuth();
  const quiz = quizzes.find((q) => q.slug === slug);

  usePageStyles(css);
  useTitle(quiz ? quiz.title : "Тест не найден");

  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState([]);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [last, setLast] = useState(null); // прошлый результат этого теста
  const savedRef = useRef(false);

  const total = quiz ? quiz.questions.length : 0;

  // Если перешли на другой тест, начинаем заново и подтягиваем прошлый результат
  useEffect(() => {
    setStep(-1);
    setAnswers([]);
    setSaveState("idle");
    setLast(null);
    savedRef.current = false;
    let cancelled = false;
    fetchResults()
      .then((rows) => {
        if (!cancelled) setLast(rows.find((r) => r.slug === slug) || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Когда дошли до результата, один раз сохраняем его в базе
  useEffect(() => {
    if (!quiz || step !== total || savedRef.current) return;
    savedRef.current = true;
    setSaveState("saving");
    saveResult(quiz.slug, answers)
      .then(() => setSaveState("saved"))
      .catch(() => setSaveState("error"));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!quiz) {
    return (
      <main className="main">
        <div className="contaniner">
          <div className="text_t">
            <h4>Тест не найден</h4>
          </div>
          <div className="text quiz_missing">
            <Link to="/tests">Вернуться к списку тестов</Link>
          </div>
        </div>
      </main>
    );
  }

  function pick(value) {
    const next = [...answers];
    next[step] = value;
    setAnswers(next);
    setStep(step + 1);
  }

  function restart() {
    setAnswers([]);
    setStep(-1);
    setSaveState("idle");
    savedRef.current = false;
    fetchResults()
      .then((rows) => setLast(rows.find((r) => r.slug === slug) || null))
      .catch(() => {});
  }

  let body;

  if (step === -1) {
    body = (
      <div className="quiz_about">
        {quiz.about.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
        {last && (
          <p className="quiz_last">
            Прошлый раз, {formatDate(last.createdAt)}:{" "}
            {last.details
              ? last.details.map((d) => `${d.title.toLowerCase()} ${d.percent}%`).join(", ")
              : `${last.score} из ${last.maxScore}, ${last.level.toLowerCase()}`}
            .
          </p>
        )}
        <div className="quiz_actions">
          <button className="quiz_btn" onClick={() => setStep(0)}>
            Начать
          </button>
        </div>
      </div>
    );
  } else if (step < total) {
    const q = quiz.questions[step];
    const options = q.options || quiz.options;
    body = (
      <>
        <p className="quiz_meta">
          Вопрос {step + 1} из {total}
        </p>
        <div
          className="quiz_progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={step}
        >
          <div className="quiz_progress_bar" style={{ width: `${(step / total) * 100}%` }} />
        </div>
        <p className="quiz_hint">{quiz.instruction}</p>
        <p className="quiz_question">{q.text}</p>
        <div className="quiz_options">
          {options.map((o) => (
            <button
              key={o.label}
              className={answers[step] === o.value ? "quiz_option quiz_option_selected" : "quiz_option"}
              onClick={() => pick(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {step > 0 && (
          <button className="quiz_back" onClick={() => setStep(step - 1)}>
            Назад
          </button>
        )}
      </>
    );
  } else {
    const { score, maxScore, level, scales } = computeResult(quiz, answers);

    const extraIndex = quiz.questions.findIndex((q) => q.scored === false);
    const extraLabel =
      extraIndex >= 0
        ? (quiz.questions[extraIndex].options || quiz.options).find((o) => o.value === answers[extraIndex])?.label
        : null;

    const showSafety = quiz.safety && answers[quiz.safety.question] > 0;

    body = (
      <>
        <p className="quiz_meta">Ваш результат</p>
        {scales ? (
          <>
            <p className="quiz_level">{level.title}</p>
            <p className="quiz_text">{level.text}</p>
            <div className="scale_list">
              {scales.map((sc) => (
                <div className="scale_row" key={sc.id}>
                  <p className="scale_title">
                    {sc.title}: {sc.percent}%
                  </p>
                  <div className="scale_bar" role="img" aria-label={`${sc.title}: ${sc.percent}%`}>
                    <div className="scale_bar_fill" style={{ width: `${sc.percent}%` }} />
                  </div>
                  <p className="scale_ends">
                    <span>{sc.low}</span>
                    <span>{sc.high}</span>
                  </p>
                  <p className="scale_text">{sc.text}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="quiz_score">
              {score} <span>из {maxScore}</span>
            </p>
            <p className="quiz_level">{level.title}</p>
            <p className="quiz_text">{level.text}</p>
          </>
        )}
        {extraLabel && <p className="quiz_extra">Влияние на повседневную жизнь: {extraLabel.toLowerCase()}</p>}
        {showSafety && (
          <div className="quiz_safety" role="alert">
            <p>{quiz.safety.text}</p>
          </div>
        )}
        <p className="quiz_note">{quiz.note}</p>
        <p className="quiz_saved" aria-live="polite">
          {saveState === "saving" && "Сохраняю результат…"}
          {saveState === "saved" &&
            (user ? (
              <>
                Результат сохранён в вашем профиле. <Link to="/profile">Открыть профиль</Link>
              </>
            ) : (
              <>
                Результат сохранён в этом браузере. Чтобы он не потерялся, <Link to="/login">войдите или создайте профиль</Link>.
              </>
            ))}
          {saveState === "error" && "Не удалось сохранить результат: сервер недоступен."}
        </p>
        <div className="quiz_actions">
          <button className="quiz_btn" onClick={restart}>
            Пройти ещё раз
          </button>
          <Link className="quiz_btn" to="/tests">
            К списку тестов
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <main className="main">
        <div className="contaniner">
          <div className="text_t">
            <h4>{quiz.title}</h4>
          </div>
          <div className="text">
            <div className="quiz">{body}</div>
          </div>
        </div>
      </main>
      <footer className="footer">
        <div className="contaniner">
          <div className="taxt_footer">
            <p>{quiz.source.text}</p>
            <a className="web" href={quiz.source.url} target="_blank" rel="noreferrer">
              <FontAwesomeIcon icon={faGlobe} /> {quiz.source.name}
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
