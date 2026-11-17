import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import quizzes from "../data/quizzes";
import { deleteAllResults, deleteResult, fetchResults } from "../api";

const formatDate = (iso) =>
  new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

// История результатов: у вошедшего пользователя это его профиль, у гостя - результаты этого браузера
export default function History() {
  const [rows, setRows] = useState(null); // null - загрузка
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchResults()
      .then(setRows)
      .catch(() => setError(true));
  }, []);

  async function remove(id) {
    try {
      await deleteResult(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError(true);
    }
  }

  async function removeAll() {
    if (!window.confirm("Удалить всю историю результатов? Это нельзя отменить.")) return;
    try {
      await deleteAllResults();
      setRows([]);
    } catch {
      setError(true);
    }
  }

  return (
    <>
      {error && <p className="quiz_saved">Не удалось связаться с сервером.</p>}
      {rows === null && !error && <p>Загружаю…</p>}
      {rows && rows.length === 0 && (
        <p>
          Пока пусто. <Link to="/tests">Пройдите первый тест</Link>.
        </p>
      )}

      {rows &&
        rows.map((r) => {
          const quiz = quizzes.find((x) => x.slug === r.slug);
          return (
            <div className="history_item" key={r.id}>
              <div>
                <p className="history_title">{quiz ? quiz.title : r.slug}</p>
                <p className="history_meta">{formatDate(r.createdAt)}</p>
              </div>
              <div>
                {r.details ? (
                  r.details.map((d) => (
                    <p className="history_meta" key={d.id}>
                      {d.title}: {d.percent}%
                    </p>
                  ))
                ) : (
                  <>
                    <p className="history_score">
                      {r.score} из {r.maxScore}
                    </p>
                    <p className="history_meta">{r.level}</p>
                  </>
                )}
              </div>
              <button className="quiz_back" onClick={() => remove(r.id)}>
                Удалить
              </button>
            </div>
          );
        })}

      {rows && rows.length > 0 && (
        <div className="quiz_actions">
          <button className="quiz_btn" onClick={removeAll}>
            Удалить всю историю
          </button>
        </div>
      )}
    </>
  );
}
