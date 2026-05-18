import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Briefcase, Sparkles } from "lucide-react";
import { fadeUp, spring } from "@/lib/motion";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string)?.trim()?.toLowerCase();
    const password = form.get("password") as string;
    if (!email || !password) {
      toast.error("Valid email and password required");
      setLoading(false);
      return;
    }
    const { error } = await signIn(email, password);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 app-mesh-bg">
      <motion.div
        className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/25 blur-3xl"
        animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-[hsl(var(--brand-violet)_/_0.2)] blur-3xl"
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 10, repeat: Infinity }}
      />

      <motion.div
        className="relative w-full max-w-md"
        initial={fadeUp.initial}
        animate={fadeUp.animate}
        transition={spring}
      >
        <Card className="border-border/60 shadow-2xl shadow-primary/15 backdrop-blur-xl">
          <CardHeader className="space-y-4 text-center">
            <motion.div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-brand"
              whileHover={{ scale: 1.05, rotate: 2 }}
              transition={spring}
            >
              <Briefcase className="h-7 w-7" />
            </motion.div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight">HireTrack</CardTitle>
              <CardDescription className="mt-1.5 flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Enterprise recruiting platform
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input id="signin-email" name="email" type="email" required placeholder="you@company.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input id="signin-password" name="password" type="password" required placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              New company?{" "}
              <Link to="/register" className="font-medium text-primary hover:text-primary/80">
                Register your organization
              </Link>
            </p>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Invited? Use the link in your email to set a password.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
