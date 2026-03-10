import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import App from "./App.jsx"
import { AppUIProvider } from "./context/AppUIContext.jsx"
import ToastContainer from "./components/ToastContainer.jsx"
import GlobalLoadingOverlay from "./components/GlobalLoadingOverlay.jsx"
import ErrorBoundary from "./components/ErrorBoundary.jsx"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AppUIProvider>
        <ErrorBoundary>
          <App />
          <ToastContainer />
          <GlobalLoadingOverlay />
        </ErrorBoundary>
      </AppUIProvider>
    </BrowserRouter>
  </StrictMode>
)
