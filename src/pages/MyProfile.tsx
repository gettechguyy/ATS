import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/** Redirects candidate to their own candidate detail page. */
export default function MyProfile() {
  const { profile, isCandidate } = useAuth();
  if (!isCandidate || !profile?.linked_candidate_id)
    return <Navigate to="/" replace />;
  return <Navigate to={`/candidates/${profile.linked_candidate_id}`} replace />;
}
