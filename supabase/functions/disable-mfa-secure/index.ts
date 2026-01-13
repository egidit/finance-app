// Secure MFA Disable Edge Function
// Verifies password + MFA code before disabling MFA

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

    // Decode base64url using Deno's base64 decoder
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const paddedBase64 = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=')
    
    // Use Deno's built-in base64 decoding
    const binaryString = atob(paddedBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const jsonPayload = new TextDecoder().decode(bytes)
    
    const payload = JSON.parse(jsonPayload)
    console.log('JWT Payload:', JSON.stringify(payload, null, 2))
    
    const userEmail = payload.email
    const userId = payload.sub
    const sessionAAL = payload.aal
    
    console.log('Extracted email:', userEmail)
    console.log('Extracted userId:', userId)
    console.log('Session AAL level:', sessionAAL)

    if (!userEmail || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing email or user ID in token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // CRITICAL SECURITY: Enforce AAL2 for MFA operations
    if (sessionAAL !== 'aal2') {
      console.error('AAL2 required but session is:', sessionAAL)
      return new Response(
        JSON.stringify({ 
          error: 'MFA verification required. Please complete the step-up challenge before disabling MFA.',
          requiresAAL2: true,
          currentAAL: sessionAAL
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('✓ Session is AAL2 - proceeding with MFA disable')

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
    const { password, mfaCode } = await req.json()

    if (!password || !mfaCode) {
      return new Response(
        JSON.stringify({ error: 'Password and MFA code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // STEP 1: Verify password - this is our security check
    const { error: passwordError } = await supabaseAdmin.auth.signInWithPassword({
      email: userEmail,
      password: password
    })

    if (passwordError) {
      return new Response(
        JSON.stringify({ error: 'Invalid password' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // STEP 2: Get MFA factors using admin client
    const { data: mfaData, error: factorsError } = await supabaseAdmin.auth.mfa.listFactors({
      userId: userId
    })
    
    if (factorsError) {
      throw new Error('Could not retrieve MFA factors: ' + factorsError.message)
    }

    const verifiedFactor = mfaData?.totp?.find((f: any) => f.status === 'verified')
    if (!verifiedFactor) {
      return new Response(
        JSON.stringify({ error: 'No MFA factor found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // STEP 4: Verify MFA code using admin client
    const { data: challengeData, error: challengeError } = await supabaseAdmin.auth.mfa.challenge({
      factorId: verifiedFactor.id
    })

    if (challengeError || !challengeData) {
      throw new Error('Failed to create MFA challenge')
    }

    const { error: verifyError } = await supabaseAdmin.auth.mfa.verify({
      factorId: verifiedFactor.id,
      challengeId: challengeData.id,
      code: mfaCode
    })

    if (verifyError) {
      return new Response(
        JSON.stringify({ error: 'Invalid MFA code' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // STEP 5: Factor Hierarchy Check - Prevent weak factors from disabling strong factors
    console.log('Checking factor hierarchy...')
    
    const FACTOR_STRENGTH: Record<string, number> = {
      'webauthn': 4,
      'totp': 3,
      'phone': 2,      // SMS
      'email': 1
    }
    
    const activeMfaFactors = mfaData?.totp?.filter((f: any) => f.status === 'verified') || []
    const factorToDisable = verifiedFactor
    const disablingFactorStrength = FACTOR_STRENGTH[factorToDisable.factor_type] || 0
    
    // Check if user is trying to disable a weaker factor while stronger ones exist
    // This PREVENTS the inverse attack (using weak factor to disable strong factor)
    const hasStrongerFactors = activeMfaFactors.some(f => 
      f.id !== factorToDisable.id && 
      (FACTOR_STRENGTH[f.factor_type] || 0) > disablingFactorStrength
    )
    
    if (hasStrongerFactors) {
      console.error('Factor hierarchy violation detected')
      return new Response(
        JSON.stringify({ 
          error: 'Cannot disable this factor while stronger security factors exist. Please disable stronger factors first (WebAuthn > TOTP > SMS > Email).',
          factorHierarchy: FACTOR_STRENGTH
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('✓ Factor hierarchy check passed')
    
    // STEP 5.5: Check if this is the last MFA factor (cooling period enforcement)
    const isLastFactor = activeMfaFactors.length === 1

    if (isLastFactor) {
      // Check 24-hour cooling period for last factor
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('last_mfa_change, mfa_factors_count')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Profile lookup error:', profileError)
        // Continue anyway - don't block on profile lookup
      } else if (profile?.last_mfa_change && profile.mfa_factors_count > 0) {
        const hoursSinceChange = (Date.now() - new Date(profile.last_mfa_change).getTime()) / (1000 * 60 * 60)
        
        if (hoursSinceChange < 24) {
          return new Response(
            JSON.stringify({ 
              error: `Cannot disable last MFA factor within 24 hours of last change. Please wait ${Math.ceil(24 - hoursSinceChange)} more hours.`,
              hoursRemaining: Math.ceil(24 - hoursSinceChange)
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // STEP 6: Update MFA factor count in profiles (will trigger cooling period tracking)
    const newFactorCount = activeMfaFactors.length - 1
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        mfa_factors_count: newFactorCount,
        last_mfa_change: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Failed to update profile:', updateError)
      // Continue anyway - don't block MFA disable on profile update
    }

    // STEP 7: Disable MFA using admin client
    const { error: unenrollError } = await supabaseAdmin.auth.mfa.unenroll({
      factorId: verifiedFactor.id
    })

    if (unenrollError) {
      throw new Error('Failed to disable MFA: ' + unenrollError.message)
    }

    // STEP 8: ATOMIC SESSION REVOCATION - Force user to re-authenticate
    console.log(`Revoking all sessions for user ${userId}`)
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId)

    if (signOutError) {
      console.error('Failed to revoke sessions:', signOutError)
      // Continue anyway - MFA already disabled
    }

    // STEP 9: Log security event to audit table
    const { error: auditError } = await supabaseAdmin
      .from('security_audit_log')
      .insert({
        user_id: userId,
        event_type: 'mfa_disabled',
        event_data: {
          factor_id: verifiedFactor.id,
          factor_type: verifiedFactor.factor_type,
          was_last_factor: isLastFactor,
          remaining_factors: newFactorCount
        },
        created_at: new Date().toISOString()
      })

    if (auditError) {
      console.error('Failed to log audit event:', auditError)
      // Continue anyway - don't block on audit logging
    }

    console.log(`MFA disabled for user ${userId} at ${new Date().toISOString()}. Sessions revoked.`)
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'MFA disabled successfully. Please sign in again.',
        requiresReauth: true
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in disable-mfa-secure:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
