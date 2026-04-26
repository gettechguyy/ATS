import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";
import { registerCompany } from "@/lib/authApi";

export default function RegisterCompany() {
  const { establishSession } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const companyName = (form.get("company_name") as string)?.trim() ?? "";
    const fullName = (form.get("full_name") as string)?.trim() ?? "";
    const email = (form.get("email") as string)?.trim()?.toLowerCase() ?? "";
    const password = form.get("password") as string;
    if (!companyName || !fullName || !email || !password) {
      toast.error("All fields are required");
      setLoading(false);
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      setLoading(false);
      return;
    }
    const { data, error } = await registerCompany(companyName, fullName, email, password);
    if (error) {
      toast.error(error.message);
    } else if (data) {
      establishSession(data);
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Briefcase className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Register your company</CardTitle>
          <CardDescription>
            Create a workspace for your organization. You will be the first admin and can add recruiters, agencies, and
            candidates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company name</Label>
              <Input id="company_name" name="company_name" type="text" required placeholder="Acme Corp" autoComplete="organization" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Your name</Label>
              <Input id="full_name" name="full_name" type="text" required placeholder="Alex Admin" autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@company.com" autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={8} placeholder="At least 8 characters" autoComplete="new-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating workspace..." : "Create company workspace"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
