import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, data } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let prompt = "";

    if (type === "interview_scheduled") {
      const { candidateName, candidateEmail, clientName, jobTitle, date, time, timeZone, mode, joiningLink, callingNumber, recruiterName } = data;
      prompt = `Generate a professional email to a job candidate about a scheduled interview. Use these details:
- Candidate: ${candidateName} (${candidateEmail})
- Client: ${clientName}
- Job Title: ${jobTitle}
- Date: ${date}
- Time: ${time} ${timeZone}
- Mode: ${mode}
${mode === "Video" ? `- Joining Link: ${joiningLink || "TBD"}` : `- Calling Number: ${callingNumber || "TBD"}`}
- Recruiter Contact: ${recruiterName}

Generate ONLY the email body in HTML format (no subject line). Keep it professional, concise, and include all logistics. Sign off from the recruiter.`;
    } else if (type === "offer_congratulations") {
      const { candidateName, candidateEmail, clientName, jobTitle, salary, employmentType, joiningDate, recruiterName } = data;
      prompt = `Generate a congratulatory email to a job candidate who received an offer. Use these details:
- Candidate: ${candidateName} (${candidateEmail})
- Client/Company: ${clientName}
- Job Title: ${jobTitle}
- Offered Salary: ${salary}
- Employment Type: ${employmentType}
- Joining Date: ${joiningDate || "TBD"}
- Recruiter: ${recruiterName}

Generate ONLY the email body in HTML format (no subject line). Be warm and congratulatory. Include job summary details. Sign off from the recruiter.`;
    } else {
      return new Response(JSON.stringify({ error: "Unknown email type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a professional recruiter email writer. Generate clean HTML email bodies." },
          { role: "user", content: prompt },
        ],
        max_tokens: 1000,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", errText);
      return new Response(JSON.stringify({ error: "Failed to generate email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const emailBody = aiData.choices?.[0]?.message?.content || "";

    // In production, you'd integrate with an email service (SendGrid, Resend, etc.)
    // For now, return the generated email content for preview
    return new Response(
      JSON.stringify({
        success: true,
        emailBody,
        to: data.candidateEmail,
        subject:
          type === "interview_scheduled"
            ? `Interview Scheduled: ${data.jobTitle} at ${data.clientName}`
            : `Congratulations! Offer for ${data.jobTitle} at ${data.clientName}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
