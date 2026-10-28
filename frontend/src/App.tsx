import React from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./app/routes";
import { AuthProvider } from "./features/auth";
import { SettingsProvider } from "./features/settings/SettingsContext";
import { ToastProvider } from "./components/ui/Toast";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
