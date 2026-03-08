import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CustomersPage from "./pages/CustomersPage";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import Layout from "./components/Layout";
function ProtectedRoute({ children }) { const { isLoggedIn } = useAuth(); return isLoggedIn ? children : <Navigate to="/login" replace />; }
function AppRoutes() { const { isLoggedIn } = useAuth(); return (<Routes><Route path="/login" element={isLoggedIn ? <Navigate to="/" replace /> : <LoginPage />} /><Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}><Route index element={<DashboardPage />} /><Route path="customers" element={<CustomersPage />} /><Route path="customers/:id" element={<CustomerDetailPage />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes>); }
export default function App() { return (<AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider>); }
