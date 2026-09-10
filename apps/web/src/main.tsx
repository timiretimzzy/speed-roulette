import React from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "./store";
import App from "./App";
import "./index.css";

useApp.getState().init();
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}