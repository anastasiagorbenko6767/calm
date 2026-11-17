import { useEffect, useState } from "react";
import usePageStyles from "../hooks/usePageStyles";
import useTitle from "../hooks/useTitle";
import css from "../styles/home.css?inline";

export default function Home() {
  usePageStyles(css);
  useTitle("Calm");

  const [showHint, setShowHint] = useState(true);
  useEffect(() => {
    const onScroll = () => setShowHint(window.scrollY < 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollDown() {
    const target = document.querySelector(".food-list");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="adaptive">
      <main className="main">
        <section className="welcome">
          <div className="contaniner">
            <div className="welkome_text">
              <h1 className="welcom_title">"Calm"</h1>
              <p className="welcome_lead">Спокойные психологические тесты и ваш путь к себе.</p>
            </div>
          </div>
          <button
            type="button"
            className={showHint ? "scroll-hint visible" : "scroll-hint"}
            onClick={scrollDown}
            aria-label="Листайте вниз"
          >
            <span className="scroll-hint_label">листайте вниз</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 10l5 5 5-5" />
              <path d="M7 4l5 5 5-5" opacity="0.55" />
            </svg>
          </button>
        </section>
        <section className="food-list">
          <div className="contaniner">
            <div className="food-list_card">
              <img src="/static/images/rb_75724.png" alt="" className="food-list_img" />
              <div className="food-list_text-wapper">
                <h4 className="food-list_title">Психологичекие тесты</h4>
                <p className="food-list_desc">Здесь можно посмотреть подборку интересных тестов, которые рекомендуют специалисты</p>
              </div>
            </div>
            <div className="food-list_card">
              <img src="/static/images/rb_77913.png" alt="" className="food-list_img" />
              <div className="food-list_text-wapper">
                <h4 className="food-list_title">психология</h4>
                <p className="food-list_desc">Здесь можно узнать историю создания такой науки, как психология. Не менее интересным будет узнать ее особенности и актуальность в наше время.</p>
              </div>
            </div>
          </div>
        </section>
        <section className="feedback">
          <div className="contaniner">
            <img className="feedback_img" src="/static/images/rb_359.png" alt="" />
            <blockquote className="feedback_text">
              <p className="feedback_desc">Когда тебе плохо — прислушайся к природе. Тишина мира успокаивает лучше, чем миллионы ненужных слов.</p>
              <cite className="feedback_aothor">Конфуций</cite>
              <span className="feedback_subauthor"> древний мыслитель и философ Китая</span>
            </blockquote>
          </div>
        </section>
      </main>
    </div>
  );
}
