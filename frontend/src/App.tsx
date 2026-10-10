import React from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./app/routes";
import { AuthProvider } from "./features/auth";
import { ToastProvider } from "./components/ui/Toast";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
