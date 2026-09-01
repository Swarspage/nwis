import { BrowserRouter } from "react-router-dom";
import { AppStateProvider } from "./AppState.jsx";
import Router from "./router.jsx";
import "./app.css";

export default function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <Router />
      </BrowserRouter>
    </AppStateProvider>
  );
}
