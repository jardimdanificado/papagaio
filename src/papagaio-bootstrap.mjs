// papagaio-bootstrap.js
// only needed if using <script type="papagaio"> in browser
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

    const s = document.createElement("div");
    s.textContent = out;
    window.document.body.appendChild(s);
  }
})();
