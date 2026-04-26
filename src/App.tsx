import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import RegisterCompany from "@/pages/RegisterCompany";
import Dashboard from "@/pages/Dashboard";
import Candidates from "@/pages/Candidates";
import CandidateDetail from "@/pages/CandidateDetail";
import Submissions from "@/pages/Submissions";
import VendorSubmissions from "@/pages/VendorSubmissions";
import SubmissionDetail from "@/pages/SubmissionDetail";
import Interviews from "@/pages/Interviews";
import Offers from "@/pages/Offers";
import UserManagement from "@/pages/UserManagement";
import Agencies from "@/pages/Agencies";
import InvitesPage from "@/pages/Invites";
import SetPasswordPage from "@/pages/SetPassword";
import MyProfile from "@/pages/MyProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function MasterCompanyRoute({ children }: { children: ReactNode }) {
  const { isMasterCompany, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-background">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  if (!isMasterCompany) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<RegisterCompany />} />
            <Route path="/set-password" element={<SetPasswordPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/candidates" element={<Candidates />} />
              <Route path="/candidates/:id" element={<CandidateDetail />} />
              <Route path="/my-profile" element={<MyProfile />} />
              <Route path="/submissions" element={<Submissions />} />
              <Route path="/submissions/:id" element={<SubmissionDetail />} />
              <Route path="/submissions-vendor" element={<VendorSubmissions />} />
              <Route path="/interviews" element={<Interviews />} />
              <Route path="/offers" element={<Offers />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route
                path="/admin/agencies"
                element={
                  <MasterCompanyRoute>
                    <Agencies />
                  </MasterCompanyRoute>
                }
              />
              <Route path="/admin/invites" element={<InvitesPage />} />
              <Route path="/set-password" element={<SetPasswordPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
