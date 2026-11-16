/** Runs in the parser before body paint; contains no account/session information. */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('dg.theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch{}})();` }} />;
}
