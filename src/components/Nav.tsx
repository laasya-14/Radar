import NavLinks from "./NavLinks";
import RunPanel from "./RunPanel";
import ThemeToggle from "./ThemeToggle";

export default function Nav() {
  return (
    <header className="nav">
      <div className="nav-inner">
        <div className="brand-wrap">
          <a href="/" className="brand">
            Radar
          </a>
          <ThemeToggle />
        </div>
        <NavLinks />
        <RunPanel />
      </div>
    </header>
  );
}
