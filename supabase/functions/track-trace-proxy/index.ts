import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { apiSourceType, secondaryApiId, apiPath, httpMethod, queryString } = await req.json();

    if (!apiPath) {
      return new Response(
        JSON.stringify({ error: "apiPath is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let baseUrl = "";
    let authHeader = "";

    if (apiSourceType === "main") {
      const { data: apiSettings, error: apiError } = await supabase
        .from("api_settings")
        .select("path, password")
        .maybeSingle();

      if (apiError) {
        throw new Error(`Failed to load API settings: ${apiError.message}`);
      }

      if (!apiSettings) {
        throw new Error("API settings not configured");
      }

      baseUrl = apiSettings.path;
      if (apiSettings.password) {
        authHeader = `Bearer ${apiSettings.password}`;
      }
    } else if (apiSourceType === "secondary" && secondaryApiId) {
      const { data: secApiData, error: secApiError } = await supabase
        .from("secondary_api_configs")
        .select("base_url, auth_token")
        .eq("id", secondaryApiId)
        .maybeSingle();

      if (secApiError) {
        throw new Error(`Failed to load secondary API config: ${secApiError.message}`);
      }

      if (!secApiData) {
        throw new Error("Secondary API configuration not found");
      }

      baseUrl = secApiData.base_url;
      if (secApiData.auth_token) {
        authHeader = `Bearer ${secApiData.auth_token}`;
      }
    } else {
      throw new Error("Invalid API source type or missing secondary API ID");
    }

    if (!baseUrl) {
      throw new Error("Base URL not configured");
    }

    baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    const fullUrl = `${baseUrl}${normalizedPath}${queryString ? '?' + queryString : ''}`;

    const fetchHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    if (authHeader) {
      fetchHeaders["Authorization"] = authHeader;
    }

    console.log(`[track-trace-proxy] Fetching: ${fullUrl}`);
    console.log(`[track-trace-proxy] Method: ${httpMethod || "GET"}`);

    const response = await fetch(fullUrl, {
      method: httpMethod || "GET",
      headers: fetchHeaders,
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[track-trace-proxy] API error: ${response.status} - ${responseText}`);
      return new Response(
        JSON.stringify({ 
          error: `API request failed: ${response.status} ${response.statusText}`,
          details: responseText
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    return new Response(
      JSON.stringify({ ...data, _requestUrl: fullUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[track-trace-proxy] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});