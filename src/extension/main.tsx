import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import "./sidepanel.css";
import App from "../App.tsx";

document.body.classList.add("chrome-sidepanel");
document.title = "Void Note";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
