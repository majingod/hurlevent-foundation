import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { ProfilProvider } from "./contexts/ProfilContext.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <ProfilProvider>
      <App />
    </ProfilProvider>
  </AuthProvider>
);
