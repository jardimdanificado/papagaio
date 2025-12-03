// papagaio-bootstrap.js
import { Papagaio } from "./papagaio.js";

(async () => {
  const p = new Papagaio();

  const nodes = [...document.querySelectorAll('script[type="papagaio"]')];

  for (const el of nodes) {
    let src = el.textContent;

    if (el.src) {
      src = await fetch(el.src).then(r => r.text());
    }

    const out = p.process(src);

    const s = document.createElement("script");
    s.type = "module";
    s.textContent = out;

    // executa no mesmo ponto onde script estava
    el.replaceWith(s);
  }
})();
