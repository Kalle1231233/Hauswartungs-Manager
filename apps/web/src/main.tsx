import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  return (
    <main>
      <h1>Hauswartungs-Manager</h1>
      <p>Grundgeruest wird initialisiert.</p>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
