import React from "react";
import { hydrateRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
hydrateRoot(
  document.getElementById("root"),
  <App
    initialData={window.__INITIAL_DATA__}
    initialUrl={window.location.pathname + window.location.search}
  />,
);
