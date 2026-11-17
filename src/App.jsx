import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import Header from "./components/Header";
import ScrollToTop from "./components/ScrollToTop";
import Home from "./pages/Home";
import Tests from "./pages/Tests";
import Quiz from "./pages/Quiz";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Forgot from "./pages/Forgot";
import Reset from "./pages/Reset";
import Verify from "./pages/Verify";
import Features from "./pages/Features";
import History from "./pages/History";
import Relevance from "./pages/Relevance";
import Chat from "./pages/Chat";

function Layout() {
  const location = useLocation();
  return (
    <>
      <ScrollToTop />
      <Header />
      <div key={location.pathname} className="page-transition">
        <Outlet />
      </div>
      <Link
        to="/chat"
        className="ai-fab"
        aria-label="Поговорить с ИИ-помощником"
        title="ИИ-помощник (скоро)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </Link>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/tests" element={<Tests />} />
        <Route path="/tests/:slug" element={<Quiz />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/reset" element={<Reset />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/results" element={<Navigate to="/profile" replace />} />
        <Route path="/psychology/features" element={<Features />} />
        <Route path="/psychology/history" element={<History />} />
        <Route path="/psychology/relevance" element={<Relevance />} />
      </Route>
    </Routes>
  );
}
