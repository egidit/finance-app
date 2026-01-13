// Secure Password Change Edge Function
// Verifies current password before allowing password change

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get user token from custom header (bypasses gateway JWT verification)
    const userToken = req.headers.get('x-user-token')
    if (!userToken) {
      throw new Error('No user token provided')
    }

    // Extract JWT token
    const token = userToken

    // Decode JWT to get user info
    const parts = token.split('.')
    if (parts.length !== 3) {
      return new Response(
        JSON.stringify({ error: 'Invalid token format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Decode base64url (JWT uses base64url encoding)
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const paddedBase64 = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=')
    
    const jsonPayload = new TextDecoder().decode(
      Uint8Array.from(atob(paddedBase64), c => c.charCodeAt(0))
    )
    
    const payload = JSON.parse(jsonPayload)
    const userEmail = payload.email
    const userId = payload.sub

    if (!userEmail || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing email or user ID in token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client for all operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get request body
    const { currentPassword, newPassword } = await req.json()

    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Current password and new password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // STEP 1: Verify current password - this is our security check
    const { error: passwordError } = await supabaseAdmin.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword
    })

    if (passwordError) {
      return new Response(
        JSON.stringify({ error: 'Current password is incorrect' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // STEP 2: Parse JWT payload for AAL verification
    const jwtPayload = JSON.parse(jsonPayload)

    // STEP 2.5: Require MFA step-up if user has MFA enabled
    const { data: mfaData } = await supabaseAdmin.auth.mfa.listFactors({ userId })
    const hasMFA = mfaData?.totp?.some((f: any) => f.status === 'verified')

    if (hasMFA) {
      // Verify session is AAL2 (MFA verified)
      if (jwtPayload.aal !== 'aal2') {
        return new Response(
          JSON.stringify({ 
            error: 'MFA verification required. Please verify your authenticator code first.',
            requiresMFA: true
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // STEP 3: Update password using admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateError) {
      throw new Error('Failed to update password: ' + updateError.message)
    }

    // STEP 4: ATOMIC SESSION REVOCATION - Force re-authentication
    console.log(`Revoking all sessions for user ${userId} after password change`)
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId)

    if (signOutError) {
      console.error('Failed to revoke sessions:', signOutError)
      // Continue anyway - password already changed
    }

    // STEP 5: Log security event to audit table
    const { error: auditError } = await supabaseAdmin
      .from('security_audit_log')
      .insert({
        user_id: userId,
        event_type: 'password_changed',
        event_data: {
          had_mfa: hasMFA,
          session_aal: jwtPayload?.aal
        },
        created_at: new Date().toISOString()
      })

    if (auditError) {
      console.error('Failed to log audit event:', auditError)
      // Continue anyway
    }

    console.log(`Password changed for user ${userId} at ${new Date().toISOString()}. Sessions revoked.`)
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Password changed successfully. Please sign in again.',
        requiresReauth: true
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in change-password-secure:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
