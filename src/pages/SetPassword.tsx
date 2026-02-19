import { useState, useEffect } from "react";
import { useSearchParams, Navigate, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createUserFromInvite } from "../../dbscripts/functions/inviteAuth";
import { fetchInviteByToken } from "../../dbscripts/functions/invites";

export default function SetPasswordPage() {
  const [search] = useSearchParams();
  const token = search.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [inviteChecking, setInviteChecking] = useState(true);

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        setInviteChecking(true);
        const inv = await fetchInviteByToken(token);
        if (!inv) {
          setInviteValid(false);
        } else if (inv.used) {
          setInviteValid(false);
        } else {
          setInviteValid(true);
        }
      } catch (err) {
        setInviteValid(false);
      } finally {
        setInviteChecking(false);
      }
    })();
  }, [token]);

  if (!token) return <div className="py-12 text-center text-muted-foreground">Invalid link</div>;
  if (done) return <Navigate to="/login" replace />;
  if (inviteChecking) return <div className="py-12 text-center text-muted-foreground">Checking link...</div>;
  if (inviteValid === false) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <h2 className="text-xl font-semibold mb-4">This invite link is no longer valid</h2>
        <p className="mb-4 text-muted-foreground">The password for this invite has already been set or the invite is invalid.</p>
        <div className="flex justify-center gap-2">
          <Link to="/login"><Button>Go to Login</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <h2 className="text-xl font-semibold mb-4">Set your password</h2>
      <div className="space-y-4">
        <div>
          <Label>Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <Label>Confirm password</Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button onClick={async () => {
          if (!password || password.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
          }
          if (password !== confirm) {
            toast.error("Passwords do not match");
            return;
          }
          const { data, error } = await createUserFromInvite(token, password);
          if (error) {
            toast.error(error.message || "Failed to set password");
            return;
          }
          toast.success("Account created. You can sign in now.");
          setDone(true);
        }}>Set password</Button>
      </div>
    </div>
  );
}

