import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Candidates from "@/pages/Candidates";
import CandidateDetail from "@/pages/CandidateDetail";
import Submissions from "@/pages/Submissions";
import SubmissionDetail from "@/pages/SubmissionDetail";
import Interviews from "@/pages/Interviews";
import Offers from "@/pages/Offers";
import UserManagement from "@/pages/UserManagement";
import MyProfile from "@/pages/MyProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/candidates" element={<Candidates />} />
              <Route path="/candidates/:id" element={<CandidateDetail />} />
              <Route path="/my-profile" element={<MyProfile />} />
              <Route path="/submissions" element={<Submissions />} />
              <Route path="/submissions/:id" element={<SubmissionDetail />} />
              <Route path="/interviews" element={<Interviews />} />
              <Route path="/offers" element={<Offers />} />
              <Route path="/admin/users" element={<UserManagement />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
