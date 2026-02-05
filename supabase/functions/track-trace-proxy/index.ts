import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function getAuthToken(supabase: any, authConfigId: string): Promise<string> {
  const { data: authConfig, error: authError } = await supabase
    .from("api_auth_config")
    .select("login_endpoint, username, password, token_field_name")
    .eq("id", authConfigId)
    .maybeSingle();

  if (authError || !authConfig) {
    throw new Error(`Failed to load auth config: ${authError?.message || "Not found"}`);
  }

  const loginResponse = await fetch(authConfig.login_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: authConfig.username,
      password: authConfig.password,
    }),
  });

  if (!loginResponse.ok) {
    const errorText = await loginResponse.text().catch(() => "");
    throw new Error(`Authentication failed: ${loginResponse.status} ${errorText}`);
  }

  const loginData = await loginResponse.json();
  const tokenFieldName = authConfig.token_field_name || "access_token";
  const token = loginData[tokenFieldName];

  if (!token) {
    throw new Error(`Login response missing '${tokenFieldName}' field`);
  }

  return token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { apiSourceType, secondaryApiId, apiPath, httpMethod, queryString, fullUrl, authConfigId, responseType } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let targetUrl = "";
    let authHeader = "";

    if (authConfigId) {
      const token = await getAuthToken(supabase, authConfigId);
      authHeader = `Bearer ${token}`;
    }

    if (fullUrl) {
      targetUrl = fullUrl;
      if (!authConfigId) {
        const { data: apiSettings } = await supabase
          .from("api_settings")
          .select("password")
          .maybeSingle();
        if (apiSettings?.password) {
          authHeader = `Bearer ${apiSettings.password}`;
        }
      }
    } else {
      if (!apiPath) {
        return new Response(
          JSON.stringify({ error: "apiPath is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let baseUrl = "";

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
        if (!authConfigId && apiSettings.password) {
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
        if (!authConfigId && secApiData.auth_token) {
          authHeader = `Bearer ${secApiData.auth_token}`;
        }
      } else {
        throw new Error("Invalid API source type or missing secondary API ID");
      }

      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const normalizedPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
      targetUrl = `${baseUrl}${normalizedPath}${queryString ? '?' + queryString : ''}`;
    }

    if (!targetUrl) {
      throw new Error("Target URL not configured");
    }

    const fetchHeaders: Record<string, string> = {};

    if (responseType === "blob") {
      fetchHeaders["Accept"] = "*/*";
    } else {
      fetchHeaders["Content-Type"] = "application/json";
      fetchHeaders["Accept"] = "application/json";
    }

    if (authHeader) {
      fetchHeaders["Authorization"] = authHeader;
    }

    console.log(`[track-trace-proxy] Fetching: ${targetUrl}`);
    console.log(`[track-trace-proxy] Method: ${httpMethod || "GET"}`);
    console.log(`[track-trace-proxy] Auth config ID: ${authConfigId || "none"}`);
    console.log(`[track-trace-proxy] Response type: ${responseType || "json"}`);

    const response = await fetch(targetUrl, {
      method: httpMethod || "GET",
      headers: fetchHeaders,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[track-trace-proxy] API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({
          error: `API request failed: ${response.status} ${response.statusText}`,
          details: errorText
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (responseType === "blob") {
      const blobData = await response.arrayBuffer();
      const contentType = response.headers.get("Content-Type") || "application/octet-stream";
      const contentDisposition = response.headers.get("Content-Disposition") || "";

      console.log(`[track-trace-proxy] Returning blob: ${blobData.byteLength} bytes, type: ${contentType}`);

      return new Response(blobData, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Content-Disposition": contentDisposition,
        }
      });
    }

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    return new Response(
      JSON.stringify({ ...data, _requestUrl: targetUrl }),
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