import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

export default function Header() {
  const { user } = useAuth();
  const [mini, setMini] = useState(false);
  const [openSub, setOpenSub] = useState(false);
  const subRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setMini(window.scrollY > 100);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!openSub) return;
    const onDown = (e) => {
      if (subRef.current && !subRef.current.contains(e.target)) setOpenSub(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [openSub]);

  useEffect(() => {
    setOpenSub(false);
  }, [location.pathname]);

  return (
    <header id="header" className={mini ? "header header_mini" : "header"}>
      <div className="contaniner">
        <div className="logo">Calm</div>

        <nav className="header_nav">
          <ul className="header_list">
            <li><Link to="/">главная</Link></li>
            <li><Link to="/tests">тесты</Link></li>
            <li>{user ? <Link to="/profile">профиль</Link> : <Link to="/login">войти</Link>}</li>
            <li ref={subRef} className={openSub ? "has-sub is-open" : "has-sub"}>
              <button
                type="button"
                className="sub-toggle"
                aria-haspopup="menu"
                aria-expanded={openSub}
                onClick={() => setOpenSub((v) => !v)}
              >
                психология <span className="sub-caret">▾</span>
              </button>
              <ul role="menu">
                <li><Link to="/psychology/features">особенности</Link></li>
                <li><Link to="/psychology/history">история</Link></li>
                <li><Link to="/psychology/relevance">актуальность</Link></li>
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
