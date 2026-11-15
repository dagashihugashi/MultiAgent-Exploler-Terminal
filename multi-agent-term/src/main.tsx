import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// StrictMode is intentionally not used: its double-invoked effects in dev
// would spawn and kill the PTY twice and race the backend session map.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
